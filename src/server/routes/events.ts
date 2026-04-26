import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { subscribeChanges } from "../lib/watcher";

// Server-Sent Events stream. The client (WorkspaceContext) opens an
// EventSource on mount and refreshes the tree whenever it receives a
// "tree-changed" event. The server also sends a periodic "ping" to keep
// idle connections alive through proxies that drop silent streams.

export const eventsRoute = new Hono();

eventsRoute.get("/", (c) => {
  return streamSSE(c, async (stream) => {
    let unsubscribe = () => {};
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    stream.onAbort(() => {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    });

    unsubscribe = subscribeChanges(() => {
      stream
        .writeSSE({
          event: "tree-changed",
          data: JSON.stringify({ at: new Date().toISOString() }),
        })
        .catch(() => {
          /* client gone; abort handler will fire */
        });
    });

    heartbeat = setInterval(() => {
      stream.writeSSE({ event: "ping", data: "" }).catch(() => {
        /* client gone */
      });
    }, 30_000);

    // Block until the client disconnects (onAbort runs).
    await new Promise<void>(() => {});
  });
});
