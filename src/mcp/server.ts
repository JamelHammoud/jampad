import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { registerTools } from "./tools";
import { getConfig } from "@/server/lib/config";

export function createMcpServer(): McpServer {
  const cfg = getConfig();
  const server = new McpServer({
    name: "jampad",
    version: "0.1.0",
    title: cfg.branding.name,
  });
  registerTools(server);
  return server;
}

export async function startStdio(): Promise<void> {
  // stdout is reserved for MCP JSON-RPC. Route any diagnostic output to stderr.
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function startHttp(opts: {
  port: number;
  host: string;
  token: string;
}): Promise<{ close: () => Promise<void> }> {
  if (!opts.token) {
    throw new Error(
      "MCP HTTP mode requires a token. Set one via --token, JAMPAD_MCP_TOKEN, or mcp.http.token in config.",
    );
  }

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  await server.connect(transport);

  const httpServer = http.createServer(async (req, res) => {
    // Bearer auth on every request.
    const auth = req.headers["authorization"] ?? "";
    const expected = `Bearer ${opts.token}`;
    if (auth !== expected) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // Parse the body for POST requests so the transport can inspect it.
    let body: unknown = undefined;
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          res.statusCode = 400;
          res.end("Invalid JSON");
          return;
        }
      }
    }

    try {
      await transport.handleRequest(req, res, body);
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(err instanceof Error ? err.message : "Internal error");
      }
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(opts.port, opts.host, () => resolve());
  });

  process.stderr.write(
    `[jampad mcp] listening on http://${opts.host}:${opts.port}\n`,
  );

  return {
    close: async () => {
      await new Promise<void>((resolve, reject) =>
        httpServer.close((err) => (err ? reject(err) : resolve())),
      );
      await transport.close();
    },
  };
}
