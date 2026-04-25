import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

// Priority order: TS variants first (richer — can declare a live ChatBackend,
// computed values, imports), JSON last. JSON skips jiti entirely.
export const CONFIG_NAMES = [
  "jampad.config.ts",
  "jampad.config.mts",
  "jampad.config.mjs",
  "jampad.config.js",
  "jampad.config.json",
];

export function findConfigFile(cwd: string): string | null {
  for (const name of CONFIG_NAMES) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function loadConfigFile(
  configPath: string,
  jampadRoot: string,
): unknown {
  if (configPath.endsWith(".json")) {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  // Use createRequire on the *consumer's* config file so jiti resolves jampad
  // out of their node_modules (or our linked package).
  const localRequire = createRequire(configPath);

  const mod = localRequire("jiti") as {
    createJiti?: typeof Function;
    default?: typeof Function;
  } & ((path: string, opts: unknown) => unknown);
  const factory =
    (mod as { createJiti?: typeof mod }).createJiti ??
    (mod as { default?: typeof mod }).default ??
    mod;
  const alias = {
    jampad: jampadRoot,
    "jampad/config": path.join(jampadRoot, "src", "server", "lib", "config.ts"),
  };
  const jiti = (factory as (p: string, o: unknown) => unknown)(configPath, {
    interopDefault: true,
    alias,
  });
  const loaded =
    typeof jiti === "function"
      ? (jiti as (p: string) => unknown)(configPath)
      : (jiti as { require: (p: string) => unknown }).require(configPath);
  return loaded && typeof loaded === "object" && "default" in loaded
    ? (loaded as { default: unknown }).default
    : loaded;
}
