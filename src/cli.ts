#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const cwd = process.cwd();

const VALID = new Set(["dev", "build", "start", "mcp"]);
const HELP_FLAGS = new Set(["help", "--help", "-h"]);

const argv = process.argv.slice(2);
if (argv.length && HELP_FLAGS.has(argv[0])) {
  console.log(`jampad [command] [flags]

Commands:
  (none)   Start the dev server (default)
  dev      Start the dev server (Vite + Hono)
  build    Build the client bundle for production
  start    Serve the prebuilt client + API
  mcp      Run the MCP server (stdio by default; --http for Streamable HTTP)

Flags:
  -p, --port <n>    Port (default: 3000, or server.port from config)
  -H, --host <h>    Host (default: 127.0.0.1, or server.host from config)
  --no-open         Don't open a browser

MCP flags (with \`mcp\`):
  --http            Listen on Streamable HTTP instead of stdio
  --port <n>        HTTP port (default: mcp.http.port from config, or 4100)
  --host <h>        HTTP host (default: 127.0.0.1)
  --token <t>       Bearer token required on every HTTP request

First run in an empty directory? Just type:  npx jampad
`);
  process.exit(0);
}

const first = argv[0];
const subcmd = first && !first.startsWith("-") ? first : "dev";
if (!VALID.has(subcmd)) {
  console.error(`Unknown command: ${subcmd}. Try \`jampad --help\`.`);
  process.exit(1);
}
const rest = first === subcmd ? argv.slice(1) : argv;

// Process env so getConfig() reads from the user's CWD.
process.env.JAMPAD_CWD = cwd;
process.env.JAMPAD_ROOT = repoRoot;

const { findConfigFile, loadConfigFile } =
  await import("./server/lib/load-config");

const configPath = findConfigFile(cwd);
let configData: Record<string, unknown> | null = null;
if (configPath) {
  try {
    configData = loadConfigFile(configPath, repoRoot) as Record<
      string,
      unknown
    >;
  } catch (err) {
    process.stderr.write(
      `[jampad] failed to read ${configPath}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

// --- MCP subcommand: dispatch and exit (long-running). -----------------------
if (subcmd === "mcp") {
  let useHttp = false;
  let mcpPort: string | null = null;
  let mcpHost: string | null = null;
  let mcpToken: string | null = null;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--http") useHttp = true;
    else if (a === "-p" || a === "--port") mcpPort = rest[++i];
    else if (a === "-H" || a === "--host") mcpHost = rest[++i];
    else if (a === "--token") mcpToken = rest[++i];
    else {
      process.stderr.write(`[jampad mcp] unknown flag: ${a}\n`);
      process.exit(1);
    }
  }

  const mod = (await import("./mcp/server")) as {
    startStdio: () => Promise<void>;
    startHttp: (opts: {
      port: number;
      host: string;
      token: string;
    }) => Promise<{ close: () => Promise<void> }>;
  };

  if (useHttp) {
    const http =
      (configData?.mcp as { http?: Record<string, unknown> })?.http ?? {};
    const port = Number(mcpPort ?? (http.port as number) ?? 4100);
    const host = mcpHost ?? (http.host as string) ?? "127.0.0.1";
    const token =
      mcpToken ?? process.env.JAMPAD_MCP_TOKEN ?? (http.token as string) ?? "";
    if (!token) {
      process.stderr.write(
        "[jampad mcp] --http requires a token. Set one via --token, JAMPAD_MCP_TOKEN, or mcp.http.token in config.\n",
      );
      process.exit(1);
    }
    await mod.startHttp({ port, host, token });
    await new Promise(() => {});
  } else {
    await mod.startStdio();
    await new Promise(() => {});
  }
  // unreachable
}

// --- HTTP server subcommands (dev, build, start). ---------------------------
const cfgServer =
  (configData?.server as { port?: number; host?: string }) ?? {};

let cliPort: string | null = null;
let cliHost: string | null = null;
let noOpen = false;
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === "-p" || a === "--port") cliPort = rest[++i];
  else if (a === "-H" || a === "--host" || a === "--hostname")
    cliHost = rest[++i];
  else if (a === "--no-open") noOpen = true;
}

const port = Number(cliPort ?? cfgServer.port ?? 3000);
const host = cliHost ?? cfgServer.host ?? "127.0.0.1";

// Zero-config first-run: create ./jam so the sidebar isn't empty.
if (subcmd === "dev" || subcmd === "start") {
  const contentDirRaw =
    ((configData?.content as { dir?: string }) ?? {}).dir ?? "./jam";
  const contentDir = resolve(cwd, contentDirRaw);
  if (!existsSync(contentDir)) {
    try {
      mkdirSync(contentDir, { recursive: true });
      const welcome = join(contentDir, "Welcome.md");
      if (!existsSync(welcome)) {
        writeFileSync(
          welcome,
          `---
title: Welcome
icon: 👋
---
You're up and running. Drop \`.md\` files anywhere under this folder and they'll show up in the sidebar.

- Press ⌘K to search pages.
- Click the **+** next to a section to add a page.
- Edit the title above and start writing.

Add a \`jampad.config.ts\` at the project root whenever you want to customize branding, theme, or enable AI chat.
`,
          "utf8",
        );
      }
      console.log(`[jampad] Created ${contentDirRaw}/ with Welcome.md`);
    } catch (err) {
      console.warn(
        `[jampad] could not create content dir:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

function openBrowser(url: string) {
  if (noOpen || process.env.JAMPAD_NO_OPEN === "1") return;
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
}

if (subcmd === "build") {
  const { build } = await import("vite");
  await build({ configFile: join(repoRoot, "vite.config.ts") });
  process.exit(0);
}

if (subcmd === "dev") {
  const t0 = performance.now();

  const { createApp } = await import("./server/createApp");
  const { serve } = await import("@hono/node-server");
  const honoPort = port + 1;
  const honoApp = createApp({});
  serve({ fetch: honoApp.fetch, port: honoPort, hostname: host });

  const { createServer } = await import("vite");
  const vite = await createServer({
    configFile: join(repoRoot, "vite.config.ts"),
    server: {
      port,
      host,
      strictPort: true,
      proxy: {
        "/api": `http://${host}:${honoPort}`,
        "/attachments": `http://${host}:${honoPort}`,
      },
    },
  });
  await vite.listen();

  const dt = (performance.now() - t0).toFixed(0);
  console.log(`\n  ▲ jampad dev ready in ${dt}ms`);
  console.log(`  → http://${host}:${port}\n`);
  openBrowser(`http://${host}:${port}`);
} else if (subcmd === "start") {
  const t0 = performance.now();

  const { EMBEDDED_ASSETS } = await import("./server/embedded-assets");
  const distRoot = resolve(repoRoot, "dist", "client");
  if (!EMBEDDED_ASSETS && !existsSync(distRoot)) {
    process.stderr.write(
      "[jampad] dist/client not found. Run `jampad build` first.\n",
    );
    process.exit(1);
  }

  const { createApp } = await import("./server/createApp");
  const { serve } = await import("@hono/node-server");
  const app = createApp({ staticRoot: EMBEDDED_ASSETS ? undefined : distRoot });
  serve({ fetch: app.fetch, port, hostname: host });

  const dt = (performance.now() - t0).toFixed(0);
  console.log(`\n  ▲ jampad ready in ${dt}ms`);
  console.log(`  → http://${host}:${port}\n`);
  openBrowser(`http://${host}:${port}`);
}
