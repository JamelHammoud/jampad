// Default stub: empty in source. `scripts/embed-assets.ts` rewrites this file
// before `bun build --compile` so the binary contains every dist/client file
// as an embedded asset (Bun's `with { type: "file" }` import attribute).
//
// In dev (`bun run src/cli.ts dev`) and the Node/npm path, this stays empty
// and createApp serves dist/client from the filesystem.
export const EMBEDDED_ASSETS: Map<string, string> | null = null;
