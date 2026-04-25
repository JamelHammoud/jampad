import type { ChatMessage, ChatMode, ClaudeStreamEvent } from "./types";
import { PLAN_TOOLS } from "./types";
import { summarizeTool } from "./toolLabel";
import { scrubLlmProse } from "./prose";

/**
 * Accumulates Claude stream events into persisted ChatMessages.
 *
 * Collapses what was previously ~6 local vars + two flush closures + a
 * post-hoc hasPlan re-stamp into one object. Call onEvent(ev) for each event,
 * then finalize() to flush buffers and get the full runLog.
 */
export class ChatStreamAccumulator {
  readonly mode: ChatMode;
  private readonly runLog: ChatMessage[] = [];
  private textBuf = "";
  private thinkBuf = "";
  private thinkingSeen = false;
  private thinkingMs: number | undefined;
  private sawPlanTool = false;
  private _sessionId: string | undefined;

  constructor(mode: ChatMode) {
    this.mode = mode;
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  onEvent(ev: ClaudeStreamEvent): void {
    switch (ev.kind) {
      case "session":
        this._sessionId = ev.sessionId;
        return;
      case "text":
        this.flushThinking();
        this.textBuf += ev.text;
        return;
      case "thinking":
        this.flushText();
        this.thinkingSeen = true;
        this.thinkBuf += ev.text;
        return;
      case "thinking_done":
        this.thinkingMs = ev.durationMs;
        this.flushThinking();
        return;
      case "tool_use":
        this.flushText();
        this.flushThinking();
        if (PLAN_TOOLS.has(ev.name.toLowerCase())) this.sawPlanTool = true;
        this.runLog.push({
          role: "tool",
          content: summarizeTool(ev.name, ev.input),
          toolName: ev.name,
          toolInput: JSON.stringify(ev.input ?? {}),
          createdAt: new Date().toISOString(),
        });
        return;
    }
  }

  finalize(): ChatMessage[] {
    this.flushThinking();
    this.flushText();

    if (this.mode === "plan" && this.sawPlanTool) {
      for (const m of this.runLog) {
        if (m.role === "assistant") m.hasPlan = true;
      }
    }
    if (this.runLog.length === 0) {
      this.runLog.push({
        role: "assistant",
        content: "(no response)",
        mode: this.mode,
        createdAt: new Date().toISOString(),
      });
    }
    return this.runLog;
  }

  private flushText(): void {
    const trimmed = this.textBuf.trim();
    this.textBuf = "";
    if (!trimmed) return;
    this.runLog.push({
      role: "assistant",
      content: scrubLlmProse(trimmed),
      mode: this.mode,
      hasPlan: this.mode === "plan" && this.sawPlanTool ? true : undefined,
      createdAt: new Date().toISOString(),
    });
  }

  private flushThinking(): void {
    const trimmed = this.thinkBuf.trim();
    this.thinkBuf = "";
    if (!trimmed && !this.thinkingSeen) {
      this.thinkingMs = undefined;
      return;
    }
    this.runLog.push({
      role: "thinking",
      content: trimmed,
      thinkingMs: this.thinkingMs,
      createdAt: new Date().toISOString(),
    });
    this.thinkingSeen = false;
    this.thinkingMs = undefined;
  }
}
