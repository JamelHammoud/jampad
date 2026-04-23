import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Boots the CLI as a subprocess with `jampad mcp` and drives it over stdio
 * with real JSON-RPC frames. Verifies the protocol handshake, tool listing,
 * and a full tools/call round-trip. Also asserts stdout contains *only*
 * JSON-RPC frames (regression guard for stray console.log).
 */

const CLI = resolve(__dirname, "..", "bin", "jampad.mjs");

type RpcResponse = {
  id?: number;
  result?: {
    tools?: Array<{ name: string }>;
    content?: Array<{ text: string }>;
    protocolVersion?: string;
    serverInfo?: { name: string };
    isError?: boolean;
  };
  error?: { code: number; message: string };
};

let workDir: string;
let child: ChildProcessWithoutNullStreams;
let stdoutBuf = "";
const pendingResolvers = new Map<number, (msg: RpcResponse) => void>();

function sendRpc(obj: Record<string, unknown>) {
  child.stdin.write(JSON.stringify(obj) + "\n");
}

function call(
  id: number,
  method: string,
  params?: unknown,
): Promise<RpcResponse> {
  return new Promise((resolveRpc, rejectRpc) => {
    const timer = setTimeout(() => {
      pendingResolvers.delete(id);
      rejectRpc(new Error(`Timeout waiting for RPC id ${id} (${method})`));
    }, 5000);
    pendingResolvers.set(id, (msg) => {
      clearTimeout(timer);
      resolveRpc(msg);
    });
    sendRpc({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });
  });
}

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), "jampad-mcp-stdio-"));
  mkdirSync(join(workDir, "jam"), { recursive: true });
  writeFileSync(
    join(workDir, "jam", "Welcome.md"),
    "---\ntitle: Welcome\nicon: 👋\n---\n\nHello from the test fixture.\n",
    "utf8",
  );

  child = spawn("node", [CLI, "mcp"], {
    cwd: workDir,
    env: { ...process.env, JAMPAD_CWD: workDir },
  }) as ChildProcessWithoutNullStreams;

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdoutBuf += chunk;
    let idx: number;
    while ((idx = stdoutBuf.indexOf("\n")) !== -1) {
      const line = stdoutBuf.slice(0, idx).trim();
      stdoutBuf = stdoutBuf.slice(idx + 1);
      if (!line) continue;
      // Every non-empty stdout line must parse as JSON-RPC.
      const msg = JSON.parse(line);
      const id = (msg as { id?: number }).id;
      if (typeof id === "number" && pendingResolvers.has(id)) {
        const r = pendingResolvers.get(id)!;
        pendingResolvers.delete(id);
        r(msg);
      }
    }
  });

  // Drain stderr so the pipe doesn't back up. Surface it on test failure only.
  child.stderr.setEncoding("utf8");
  let stderrBuf = "";
  child.stderr.on("data", (chunk: string) => {
    stderrBuf += chunk;
  });
  (globalThis as Record<string, unknown>).__mcpStderr = () => stderrBuf;

  // Handshake.
  const init = await call(1, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "vitest", version: "0" },
  });
  expect(init.result!.protocolVersion).toBeTruthy();
  expect(init.result!.serverInfo!.name).toBe("jampad");

  sendRpc({ jsonrpc: "2.0", method: "notifications/initialized" });
});

afterAll(async () => {
  child.stdin.end();
  child.kill("SIGTERM");
  await new Promise<void>((r) => child.once("close", () => r()));
  rmSync(workDir, { recursive: true, force: true });
});

describe("jampad mcp (stdio integration)", () => {
  it("lists all 7 tools", async () => {
    const res = await call(2, "tools/list");
    const names = res.result!.tools!.map((t) => t.name).sort();
    expect(names).toEqual([
      "create_page",
      "delete_page",
      "list_pages",
      "read_page",
      "rename_page",
      "search_pages",
      "update_page",
    ]);
  });

  it("calls read_page end-to-end and receives page content", async () => {
    const res = await call(3, "tools/call", {
      name: "read_page",
      arguments: { slug: ["Welcome"] },
    });
    expect(res.error).toBeUndefined();
    const text = res.result!.content![0].text;
    const payload = JSON.parse(text);
    expect(payload.title).toBe("Welcome");
    expect(payload.markdown).toContain("Hello from the test fixture");
  });

  it("returns an MCP error for a missing page", async () => {
    const res = await call(4, "tools/call", {
      name: "read_page",
      arguments: { slug: ["nope"] },
    });
    // MCP convention: handler errors surface as result.isError, not rpc.error.
    const hasError = res.error !== undefined || res.result?.isError === true;
    expect(hasError).toBe(true);
  });

  it("creates, reads, and deletes a page via tools/call", async () => {
    const create = await call(5, "tools/call", {
      name: "create_page",
      arguments: { title: "Stdio Created", markdown: "from stdio" },
    });
    expect(create.error).toBeUndefined();
    const { slug } = JSON.parse(create.result!.content![0].text);

    const read = await call(6, "tools/call", {
      name: "read_page",
      arguments: { slug },
    });
    const page = JSON.parse(read.result!.content![0].text);
    expect(page.markdown).toContain("from stdio");

    const del = await call(7, "tools/call", {
      name: "delete_page",
      arguments: { slug },
    });
    expect(del.error).toBeUndefined();
  });
});
