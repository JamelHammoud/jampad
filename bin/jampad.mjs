#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const jampadRoot = resolve(here, "..");
const cwd = process.cwd();
const require = createRequire(import.meta.url);

// Shared config loader (CommonJS helper, usable from both CLI and server).
const { findConfigFile, loadConfigFile } = require(
  join(jampadRoot, "src", "lib", "load-config.js"),
);

const VALID = new Set(["dev", "build", "start", "mcp"]);
const HELP_FLAGS = new Set(["help", "--help", "-h"]);

const raw = process.argv.slice(2);
if (raw.length && HELP_FLAGS.has(raw[0])) {
  console.log(`jampad [command] [flags]

Commands:
  (none)   Start the dev server (default)
  dev      Start the dev server
  build    Build for production
  start    Start the production server (after build)
  mcp      Run as an MCP server (stdio by default; --http for Streamable HTTP)

Flags:
  -p, --port <n>    Port (default: 3000, or server.port from config)
  -H, --host <h>    Host (default: 127.0.0.1, or server.host from config)

MCP flags (with \`mcp\`):
  --http            Listen on Streamable HTTP instead of stdio
  --port <n>        HTTP port (default: mcp.http.port from config, or 4100)
  --host <h>        HTTP host (default: 127.0.0.1)
  --token <t>       Bearer token required on every HTTP request

First run in an empty directory? Just type:  npx jampad
`);
  process.exit(0);
}

// Subcommand defaults to "dev" when argv[0] is missing or looks like a flag.
const first = raw[0];
const subcmd = first && !first.startsWith("-") ? first : "dev";
if (!VALID.has(subcmd)) {
  console.error(`Unknown command: ${subcmd}. Try \`jampad --help\`.`);
  process.exit(1);
}
const rest = first === subcmd ? raw.slice(1) : raw;

const configPath = findConfigFile(cwd);

let configData = null;
if (configPath) {
  try {
    configData = loadConfigFile(configPath, jampadRoot);
  } catch (err) {
    // stderr in all subcommands — stdout is reserved in `mcp` stdio mode.
    process.stderr.write(
      `[jampad] failed to read ${configPath}: ${err?.message ?? err}\n`,
    );
  }
}

// ---- MCP subcommand ----
if (subcmd === "mcp") {
  // Parse MCP flags.
  let useHttp = false;
  let mcpPort = null;
  let mcpHost = null;
  let mcpToken = null;
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

  // Ensure the MCP server loads config from the user's CWD.
  process.env.JAMPAD_CWD = cwd;
  process.env.JAMPAD_ROOT = jampadRoot;

  // Load src/mcp/server.ts via jiti (same pattern as the TS config loader).
  const jitiMod = require("jiti");
  const jitiFactory = jitiMod.createJiti ?? jitiMod.default ?? jitiMod;
  const jiti = jitiFactory(join(jampadRoot, "bin", "jampad.mjs"), {
    interopDefault: true,
    alias: {
      "@": join(jampadRoot, "src"),
    },
  });
  const load = typeof jiti === "function" ? jiti : (p) => jiti.require(p);

  try {
    const mod = load(join(jampadRoot, "src", "mcp", "server.ts"));
    const { startStdio, startHttp } = mod.default ?? mod;

    if (useHttp) {
      const http = configData?.mcp?.http ?? {};
      const port = Number(mcpPort ?? http.port ?? 4100);
      const host = mcpHost ?? http.host ?? "127.0.0.1";
      const token =
        mcpToken ?? process.env.JAMPAD_MCP_TOKEN ?? http.token ?? "";
      if (!token) {
        process.stderr.write(
          "[jampad mcp] --http requires a token. Set one via --token, JAMPAD_MCP_TOKEN, or mcp.http.token in config.\n",
        );
        process.exit(1);
      }
      await startHttp({ port, host, token });
      // startHttp returns after listening; keep the process alive until signaled.
      await new Promise(() => {});
    } else {
      await startStdio();
      // stdio transport runs until stdin closes; startStdio returns quickly
      // after connect(), so wait on the process itself.
      await new Promise(() => {});
    }
  } catch (err) {
    process.stderr.write(
      `[jampad mcp] failed to start: ${err?.message ?? err}\n`,
    );
    process.exit(1);
  }
  // Unreachable — the process stays alive for the MCP lifetime.
}

// Zero-config first-run: make sure ./jam exists so the sidebar isn't empty.
// We don't write a config file — users can drop one in whenever they want to customize.
if (subcmd === "dev" || subcmd === "start") {
  const contentDirRaw = configData?.content?.dir ?? "./jam";
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

# Welcome

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
        err?.message ?? err,
      );
    }
  }
}

const configPort = configData?.server?.port;
const configHost = configData?.server?.host;

let cliPort = null;
let cliHost = null;
const forwarded = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === "-p" || a === "--port") cliPort = rest[++i];
  else if (a === "-H" || a === "--host" || a === "--hostname")
    cliHost = rest[++i];
  else forwarded.push(a);
}

const port = cliPort ?? configPort;
const host = cliHost ?? configHost;

const args = [subcmd];
if (subcmd === "dev" || subcmd === "start") {
  if (port) args.push("-p", String(port));
  if (host) args.push("-H", String(host));
}
args.push(...forwarded);

const nextBin = join(jampadRoot, "node_modules", ".bin", "next");
const bin = existsSync(nextBin) ? nextBin : "npx";
const binArgs = bin === "npx" ? ["next", ...args] : args;

const child = spawn(bin, binArgs, {
  cwd: jampadRoot,
  env: {
    ...process.env,
    JAMPAD_CWD: cwd,
    JAMPAD_ROOT: jampadRoot,
  },
  stdio: "inherit",
});

child.on("close", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("[jampad] failed to start:", err.message);
  process.exit(1);
});
