import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Hono } from "hono";

/**
 * Drives /api/events via app.fetch() and asserts the SSE stream emits a
 * `tree-changed` event whenever the file watcher fires. We avoid touching
 * disk in the assertion — the watcher's own fs.watch is platform-flaky in
 * CI sandboxes — and use the test-only emit hook on the watcher module.
 */

let workDir: string;
let app: Hono;
let emitChange: () => void;

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), "jampad-events-"));
  mkdirSync(join(workDir, "jam"), { recursive: true });
  writeFileSync(
    join(workDir, "jam", "Welcome.md"),
    "---\ntitle: Welcome\n---\n\nhi\n",
    "utf8",
  );
  process.env.JAMPAD_CWD = workDir;

  const { createApp } = await import("@/server/createApp");
  app = createApp({});

  const watcher = await import("@/server/lib/watcher");
  emitChange = watcher.__emitChangeForTesting;
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

async function readOneSseEvent(
  body: ReadableStream<Uint8Array>,
  matchEventName: string,
  timeoutMs: number,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let buf = "";

  try {
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream closed before event arrived");
      buf += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line (\n\n). Parse them as they
      // accumulate.
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const lines = frame.split("\n");
        const eventName =
          lines
            .find((l) => l.startsWith("event:"))
            ?.slice(6)
            .trim() ?? "message";
        if (eventName === matchEventName) {
          return frame;
        }
      }
    }
    throw new Error(`timed out waiting for ${matchEventName}`);
  } finally {
    reader.cancel().catch(() => {});
  }
}

describe("/api/events SSE", () => {
  it("streams a tree-changed event when the watcher fires", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/events", { method: "GET" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.body).not.toBeNull();

    // Race: read the next tree-changed frame, with a watcher emit kicked off
    // shortly after we start reading so the subscription is registered first.
    const reading = readOneSseEvent(res.body!, "tree-changed", 3000);
    setTimeout(() => emitChange(), 50);

    const frame = await reading;
    expect(frame).toContain("event: tree-changed");
    expect(frame).toMatch(/data: \{.*"at":/);
  });
});
