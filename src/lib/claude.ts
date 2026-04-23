import { spawn } from "node:child_process";
import { contentRoot } from "./paths";
import { getConfig } from "./config";
import type { ClaudeStreamEvent } from "./types";

export type { ClaudeStreamEvent };

type RunOptions = {
  prompt: string;
  resumeSessionId?: string;
  mode: "plan" | "apply";
  onEvent: (event: ClaudeStreamEvent) => void;
  signal?: AbortSignal;
};

export async function runClaude({
  prompt,
  resumeSessionId,
  mode,
  onEvent,
  signal,
}: RunOptions): Promise<void> {
  const cfg = getConfig();
  const claude = cfg.chats.claude;
  const binary = claude.binary;
  const cwd = claude.cwd;
  const model = claude.model;
  const effort = claude.effort;
  const addDirs = claude.addDirs ?? [contentRoot()];
  const systemPrompt = claude.systemPrompt;

  const args: string[] = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--model",
    model,
    "--effort",
    effort,
    "--permission-mode",
    mode === "plan" ? "bypassPermissions" : "acceptEdits",
  ];
  for (const d of addDirs) args.push("--add-dir", d);
  if (systemPrompt) args.push("--append-system-prompt", systemPrompt);
  if (mode === "plan") {
    args.push("--disallowedTools", "Edit Write MultiEdit NotebookEdit");
  }
  if (resumeSessionId) {
    args.push("--resume", resumeSessionId);
  }
  args.push("--", prompt);

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const state: TranslatorState = { blocksByIndex: new Map() };

    let stderrBuf = "";
    let buf = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buf += chunk;
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const ev = JSON.parse(line);
          translate(ev, state, onEvent);
        } catch {
          /* ignore non-JSON */
        }
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderrBuf += chunk;
    });

    if (signal) {
      signal.addEventListener("abort", () => {
        child.kill("SIGTERM");
      });
    }

    child.on("error", (err) => {
      onEvent({ kind: "error", message: err.message });
      reject(err);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        const msg = stderrBuf.trim() || `claude exited with code ${code}`;
        onEvent({ kind: "error", message: msg });
      }
      onEvent({ kind: "done" });
      resolve();
    });
  });
}

type BlockState =
  | { kind: "text" }
  | { kind: "thinking"; startedAt: number }
  | { kind: "tool_use"; id: string; name: string; rawInput: string };

type TranslatorState = {
  blocksByIndex: Map<number, BlockState>;
};

function translate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ev: any,
  state: TranslatorState,
  out: (e: ClaudeStreamEvent) => void,
) {
  if (!ev || typeof ev !== "object") return;

  if (ev.type === "system" && ev.subtype === "init" && ev.session_id) {
    out({ kind: "session", sessionId: ev.session_id });
    return;
  }

  if (ev.type === "stream_event" && ev.event) {
    const inner = ev.event;
    if (inner.type === "content_block_start" && inner.content_block) {
      const index = inner.index as number;
      const cb = inner.content_block;
      if (cb.type === "text") {
        state.blocksByIndex.set(index, { kind: "text" });
      } else if (cb.type === "thinking") {
        state.blocksByIndex.set(index, {
          kind: "thinking",
          startedAt: Date.now(),
        });
        out({ kind: "thinking", text: "" });
      } else if (cb.type === "tool_use") {
        state.blocksByIndex.set(index, {
          kind: "tool_use",
          id: String(cb.id ?? ""),
          name: String(cb.name ?? "tool"),
          rawInput: "",
        });
      }
      return;
    }
    if (inner.type === "content_block_delta" && inner.delta) {
      const index = inner.index as number;
      const block = state.blocksByIndex.get(index);
      if (!block) return;
      const d = inner.delta;
      if (block.kind === "text" && d.type === "text_delta" && d.text) {
        out({ kind: "text", text: String(d.text) });
      } else if (
        block.kind === "thinking" &&
        d.type === "thinking_delta" &&
        d.thinking
      ) {
        out({ kind: "thinking", text: String(d.thinking) });
      } else if (
        block.kind === "tool_use" &&
        d.type === "input_json_delta" &&
        typeof d.partial_json === "string"
      ) {
        block.rawInput += d.partial_json;
      }
      return;
    }
    if (inner.type === "content_block_stop") {
      const index = inner.index as number;
      const block = state.blocksByIndex.get(index);
      if (block && block.kind === "tool_use") {
        let input: Record<string, unknown> = {};
        if (block.rawInput) {
          try {
            input = JSON.parse(block.rawInput) as Record<string, unknown>;
          } catch {
            /* ignore malformed */
          }
        }
        out({
          kind: "tool_use",
          id: block.id,
          name: block.name,
          input,
        });
      } else if (block && block.kind === "thinking") {
        out({
          kind: "thinking_done",
          durationMs: Date.now() - block.startedAt,
        });
      }
      state.blocksByIndex.delete(index);
      return;
    }
    return;
  }

  if (ev.type === "user" && ev.message?.content) {
    for (const part of ev.message.content) {
      if (part.type === "tool_result") {
        const text = Array.isArray(part.content)
          ? part.content.map((c: { text?: string }) => c.text ?? "").join("\n")
          : typeof part.content === "string"
            ? part.content
            : "";
        out({
          kind: "tool_result",
          id: String(part.tool_use_id ?? ""),
          content: text,
          ok: !part.is_error,
        });
      }
    }
    return;
  }

  if (ev.type === "result") {
    out({
      kind: "done",
      result: typeof ev.result === "string" ? ev.result : undefined,
    });
    return;
  }
}
