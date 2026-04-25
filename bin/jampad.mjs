#!/usr/bin/env node
// Tiny launcher. The real CLI lives in src/cli.ts so it can be transpiled by
// Vite for the npm tarball, run under Bun directly, or compiled to a single
// binary with `bun build --compile`.
//
// At runtime we either:
//   - run under Bun, where TS is native
//   - run under Node, where we use jiti to load the TS source on the fly
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = join(here, "..", "src", "cli.ts");

if (typeof Bun !== "undefined") {
  await import(cliPath);
} else {
  const require = createRequire(import.meta.url);
  const jitiMod = require("jiti");
  const factory = jitiMod.createJiti ?? jitiMod.default ?? jitiMod;
  const jiti = factory(import.meta.url, {
    interopDefault: true,
    alias: {
      "@": join(here, "..", "src"),
    },
  });
  await jiti.import(cliPath);
}
