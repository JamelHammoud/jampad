import { defineConfig } from "vitest/config";
import path from "node:path";

// Default: unit tests only. Integration tests under tests/integration/ pack
// the npm tarball, install it in a fresh dir, spawn the CLI, and exercise
// real disk I/O — slow and broader in scope. Run those via
// `bun run test:integration` (vitest.integration.config.ts).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**", "node_modules/**", "dist/**"],
    environment: "node",
  },
});
