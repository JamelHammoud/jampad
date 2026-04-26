#!/usr/bin/env node
// Tiny launcher.
//
// In the npm tarball: dist/cli.js exists (a bundled, dependency-free Node ESM
// file produced by `bun build`). Run it directly under whatever runtime is
// available — no transpiler, no transitive deps, no node_modules dance.
//
// In the source repo before `bun run build` has happened: fall back to
// running src/cli.ts under Bun (Bun has native TS).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const bundledCli = join(repoRoot, "dist", "cli.js");
const sourceCli = join(repoRoot, "src", "cli.ts");

if (existsSync(bundledCli)) {
  await import(bundledCli);
} else if (typeof Bun !== "undefined") {
  await import(sourceCli);
} else {
  process.stderr.write(
    "[jampad] dist/cli.js not found. Run `bun run build` first, or run via `bun bin/jampad.mjs`.\n",
  );
  process.exit(1);
}
