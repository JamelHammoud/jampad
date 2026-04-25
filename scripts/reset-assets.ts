// Restores src/server/embedded-assets.ts to its empty default after the
// binary compile, so working-tree dev runs use the filesystem path again
// and `git status` stays clean.

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const outPath = join(repoRoot, "src", "server", "embedded-assets.ts");

const stub = `// Default stub: empty in source. \`scripts/embed-assets.ts\` rewrites this file
// before \`bun build --compile\` so the binary contains every dist/client file
// as an embedded asset (Bun's \`with { type: "file" }\` import attribute).
//
// In dev (\`bun run src/cli.ts dev\`) and the Node/npm path, this stays empty
// and createApp serves dist/client from the filesystem.
export const EMBEDDED_ASSETS: Map<string, string> | null = null;
`;

writeFileSync(outPath, stub);
console.log("[jampad] reset embedded-assets.ts to stub");
