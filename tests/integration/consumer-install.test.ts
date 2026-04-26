import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * End-to-end test for the consumer install path.
 *
 * Why this lives in tests/integration/ and not the regular vitest suite:
 * the regular suite runs inside the dev tree where every package is
 * installed, which hides bugs where runtime code references a devDependency.
 * This test packs the package, installs it into a fresh dir with --omit=dev
 * (mirroring `npx <pkg>`), spawns `npx jampad`, and exercises the real
 * filesystem through the API. Takes ~10 seconds — too slow for the inner loop.
 *
 * Skipped from `bun run test`. Run via `bun run test:integration`.
 */

const repoRoot = resolve(__dirname, "..", "..");
const PORT = 4180 + Math.floor(Math.random() * 100);
const baseUrl = `http://127.0.0.1:${PORT}`;

let consumerDir: string;
let tarball: string;
let child: ChildProcess;
let stdoutBuf = "";
let stderrBuf = "";

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "content-type": "application/json" };
  }
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    data = text as unknown as T;
  }
  return { status: res.status, data };
}

async function waitFor(
  fn: () => boolean | Promise<boolean>,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `timed out after ${timeoutMs}ms\n--- stdout ---\n${stdoutBuf}\n--- stderr ---\n${stderrBuf}`,
  );
}

beforeAll(async () => {
  // 1. Pack the working tree.
  const pack = spawnSync(
    "npm",
    ["pack", "--pack-destination", tmpdir(), "--silent"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (pack.status !== 0) throw new Error(`npm pack failed: ${pack.stderr}`);
  const tarballName = pack.stdout.trim().split("\n").at(-1);
  if (!tarballName) throw new Error("npm pack produced no tarball name");
  tarball = join(tmpdir(), tarballName);

  // 2. Install in a fresh consumer dir with --omit=dev.
  consumerDir = mkdtempSync(join(tmpdir(), "jampad-consumer-"));
  spawnSync("npm", ["init", "-y"], { cwd: consumerDir, encoding: "utf8" });
  const install = spawnSync(
    "npm",
    ["install", "--omit=dev", "--no-fund", "--no-audit", tarball],
    { cwd: consumerDir, encoding: "utf8" },
  );
  if (install.status !== 0) {
    throw new Error(`npm install failed:\n${install.stderr}`);
  }

  // 3. Spawn `npx jampad` (defaults to `start`).
  child = spawn("npx", ["jampad", "-p", String(PORT), "--no-open"], {
    cwd: consumerDir,
    env: { ...process.env, JAMPAD_NO_OPEN: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout!.on("data", (d) => {
    stdoutBuf += d.toString();
  });
  child.stderr!.on("data", (d) => {
    stderrBuf += d.toString();
  });

  // 4. Wait for the server to come up.
  await waitFor(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/config`);
      return res.ok;
    } catch {
      return false;
    }
  }, 30_000);
}, 60_000);

afterAll(() => {
  try {
    child?.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  if (consumerDir) rmSync(consumerDir, { recursive: true, force: true });
  if (tarball) rmSync(tarball, { force: true });
});

describe("consumer install (npm pack + --omit=dev + npx jampad)", () => {
  it("installs without pulling devDependencies (small footprint)", () => {
    // Sanity check: the install footprint should be tiny now that the server
    // is bundled. If it bloats again, this fails loudly.
    const nodeModules = join(consumerDir, "node_modules");
    expect(existsSync(nodeModules)).toBe(true);

    // None of the bundled-into-dist deps (react, blocknote, mantine, hono…)
    // should be present in the consumer's tree.
    const blocked = [
      "react",
      "react-dom",
      "@blocknote/core",
      "@mantine/core",
      "hono",
      "@modelcontextprotocol/sdk",
      "zod",
      "fuse.js",
      "gray-matter",
    ];
    for (const pkg of blocked) {
      expect(
        existsSync(join(nodeModules, pkg)),
        `${pkg} should not be installed (bundled into dist/cli.js)`,
      ).toBe(false);
    }
  });

  it("serves /api/config", async () => {
    const res = await api<{ branding: { name: string } }>("GET", "/api/config");
    expect(res.status).toBe(200);
    expect(res.data.branding.name).toBeTruthy();
  });

  it("serves the SPA shell on every non-API path", async () => {
    const res = await fetch(`${baseUrl}/Welcome`);
    expect(res.ok).toBe(true);
    const html = await res.text();
    expect(html).toContain("<!doctype html");
    expect(html).toContain('<div id="root">');
  });

  it("seeds ./jam/Welcome.md on first run", () => {
    const welcome = join(consumerDir, "jam", "Welcome.md");
    expect(existsSync(welcome)).toBe(true);
    expect(readFileSync(welcome, "utf8")).toContain("title: Welcome");
  });

  it("creates a page on disk via POST /api/pages", async () => {
    const res = await api<{ slug: string[] }>("POST", "/api/pages", {
      parentSlug: [],
      title: "Integration Test",
      kind: "page",
    });
    expect(res.status).toBe(200);
    expect(res.data.slug).toEqual(["Integration-Test"]);
    expect(existsSync(join(consumerDir, "jam", "Integration-Test.md"))).toBe(
      true,
    );
  });

  it("writes through to disk on PUT /api/pages/:slug", async () => {
    const res = await api<{ ok: boolean }>(
      "PUT",
      "/api/pages/Integration-Test",
      {
        title: "Integration Test",
        icon: "🧪",
        cover: null,
        markdown: "Hello from the consumer-install integration test.",
      },
    );
    expect(res.status).toBe(200);

    const onDisk = readFileSync(
      join(consumerDir, "jam", "Integration-Test.md"),
      "utf8",
    );
    // gray-matter may serialize emoji as either the literal char or a YAML
    // unicode escape (\U0001F9EA). Either is fine.
    expect(onDisk).toMatch(/icon:\s*("?(\\U[0-9A-Fa-f]+|🧪))/);
    expect(onDisk).toContain("Hello from the consumer-install integration");
  });

  it("renames on disk via PATCH /api/pages/:slug", async () => {
    const res = await api<{ slug: string[] }>(
      "PATCH",
      "/api/pages/Integration-Test",
      { toSlug: ["Integration-Renamed"] },
    );
    expect(res.status).toBe(200);
    expect(existsSync(join(consumerDir, "jam", "Integration-Test.md"))).toBe(
      false,
    );
    expect(existsSync(join(consumerDir, "jam", "Integration-Renamed.md"))).toBe(
      true,
    );
  });

  it("creates a folder on disk via POST kind=folder", async () => {
    const res = await api<{ kind: string }>("POST", "/api/pages", {
      parentSlug: [],
      title: "MyFolder",
      kind: "folder",
    });
    expect(res.status).toBe(200);
    expect(res.data.kind).toBe("folder");
    const folder = join(consumerDir, "jam", "MyFolder");
    expect(existsSync(folder)).toBe(true);
    expect(statSync(folder).isDirectory()).toBe(true);
  });

  it("picks up out-of-band file edits", async () => {
    // Simulate a user editing markdown directly with a different editor.
    writeFileSync(
      join(consumerDir, "jam", "HandWritten.md"),
      "---\ntitle: Hand Written\nicon: ✍️\n---\n\nWritten on disk, no API.\n",
      "utf8",
    );
    const res = await api<{ title: string; markdown: string }>(
      "GET",
      "/api/pages/HandWritten",
    );
    expect(res.status).toBe(200);
    expect(res.data.title).toBe("Hand Written");
    expect(res.data.markdown).toContain("Written on disk");
  });

  it("indexes new pages for /api/search", async () => {
    const res = await api<{ results: { title: string }[] }>(
      "GET",
      "/api/search?q=integration",
    );
    expect(res.data.results.some((r) => r.title === "Integration Test")).toBe(
      true,
    );
  });

  it("removes from disk via DELETE /api/pages/:slug", async () => {
    const res = await api<{ ok: boolean }>(
      "DELETE",
      "/api/pages/Integration-Renamed",
    );
    expect(res.status).toBe(200);
    expect(existsSync(join(consumerDir, "jam", "Integration-Renamed.md"))).toBe(
      false,
    );
  });

  it("logs no errors over the whole session", () => {
    expect(stderrBuf).not.toMatch(/\b(error|exception|throw)\b/i);
  });
});
