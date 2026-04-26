import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

// Priority: richer formats first, JSON last. .ts/.mts work natively under
// Bun; under Node they require Node 22+ with --experimental-strip-types or
// will fail — pick .mjs/.json if you need Node-only support.
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

export async function loadConfigFile(configPath: string): Promise<unknown> {
  if (configPath.endsWith(".json")) {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  // Native dynamic import. Bun handles .ts/.mts natively; Node handles
  // .mjs/.js out of the box and (recent versions) .ts behind a flag.
  const mod = (await import(pathToFileURL(configPath).href)) as {
    default?: unknown;
  };
  return mod.default ?? mod;
}
