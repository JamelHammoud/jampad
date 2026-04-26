import { watch, type FSWatcher } from "node:fs";
import { EventEmitter } from "node:events";
import { contentRoot, attachmentsRoot } from "./paths";

// Single fs.watch on the content root, fans out to many SSE subscribers.
// Events are debounced to coalesce noisy bursts (editor saves often fire
// half a dozen events for a single user-visible change).

const emitter = new EventEmitter();
emitter.setMaxListeners(0); // any number of SSE clients

let watcher: FSWatcher | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function ensureWatcher() {
  if (watcher) return;
  try {
    watcher = watch(contentRoot(), { recursive: true }, (_event, filename) => {
      if (!filename) return;
      // Ignore writes inside the attachments subfolder — they don't change
      // the page tree and would cause unnecessary refreshes when uploading.
      const attachRel = attachmentsRoot();
      if (filename.startsWith(attachRel)) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        emitter.emit("change");
      }, 150);
    });
  } catch (err) {
    process.stderr.write(
      `[jampad] file watcher disabled: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

export function subscribeChanges(cb: () => void): () => void {
  ensureWatcher();
  emitter.on("change", cb);
  return () => emitter.off("change", cb);
}

// Test-only hook so vitest can flush a synthetic event without touching disk.
export function __emitChangeForTesting() {
  emitter.emit("change");
}
