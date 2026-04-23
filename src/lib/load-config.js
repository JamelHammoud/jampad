// Shared config loader. Invoked from both the Jampad server module
// (src/lib/config.ts) and the CLI entry (bin/jampad.mjs). Pure JS so the
// CLI can require() it without needing TypeScript support at the entry boundary.

const { createRequire } = require("node:module");
const path = require("node:path");
const fs = require("node:fs");

// Priority order: TS variants first (richer — can declare a live ChatBackend,
// computed values, imports), JSON last. JSON skips jiti entirely.
const CONFIG_NAMES = [
  "jampad.config.ts",
  "jampad.config.mts",
  "jampad.config.mjs",
  "jampad.config.js",
  "jampad.config.json",
];

function findConfigFile(cwd) {
  for (const name of CONFIG_NAMES) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadConfigFile(configPath, jampadRoot) {
  if (configPath.endsWith(".json")) {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  const localRequire = createRequire(__filename);
  const mod = localRequire("jiti");
  const factory = mod.createJiti ?? mod.default ?? mod;
  const alias = {
    jampad: jampadRoot,
    "jampad/config": path.join(jampadRoot, "src", "lib", "config.ts"),
  };
  const jiti = factory(configPath, { interopDefault: true, alias });
  const loaded =
    typeof jiti === "function" ? jiti(configPath) : jiti.require(configPath);
  return loaded && typeof loaded === "object" && "default" in loaded
    ? loaded.default
    : loaded;
}

module.exports = { CONFIG_NAMES, findConfigFile, loadConfigFile };
