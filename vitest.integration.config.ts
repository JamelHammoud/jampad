import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration suite: packs the npm tarball, installs into a fresh tmp dir
// with --omit=dev, spawns `npx jampad`, and drives real disk I/O through the
// API. Slow on purpose. Exercised via `bun run test:integration`, both
// locally and in CI (separate from the fast unit suite).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Each integration test spawns a real server on a random port. Run
    // sequentially so ports and tmp dirs don't collide.
    fileParallelism: false,
    pool: "forks",
    forks: { singleFork: true },
  },
});
