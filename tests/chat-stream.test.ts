import { describe, it, expect } from "vitest";
import { ChatStreamAccumulator } from "@/shared/chat-stream";
import type { ClaudeStreamEvent } from "@/shared/types";

function feed(acc: ChatStreamAccumulator, events: ClaudeStreamEvent[]) {
  for (const ev of events) acc.onEvent(ev);
}

describe("ChatStreamAccumulator", () => {
  it("captures sessionId from session event", () => {
    const acc = new ChatStreamAccumulator("plan");
    acc.onEvent({ kind: "session", sessionId: "abc-123" });
    expect(acc.sessionId).toBe("abc-123");
  });

  it("merges consecutive text events into a single assistant message", () => {
    const acc = new ChatStreamAccumulator("plan");
    feed(acc, [
      { kind: "text", text: "Hello " },
      { kind: "text", text: "world" },
    ]);
    const log = acc.finalize();
    expect(log).toHaveLength(1);
    expect(log[0].role).toBe("assistant");
    expect(log[0].content).toBe("Hello world");
  });

  it("merges consecutive thinking events into a single thinking message", () => {
    const acc = new ChatStreamAccumulator("plan");
    feed(acc, [
      { kind: "thinking", text: "Let me " },
      { kind: "thinking", text: "consider..." },
      { kind: "thinking_done", durationMs: 1234 },
    ]);
    const log = acc.finalize();
    expect(log).toHaveLength(1);
    expect(log[0].role).toBe("thinking");
    expect(log[0].content).toBe("Let me consider...");
    expect(log[0].thinkingMs).toBe(1234);
  });

  it("creates a tool message for each tool_use event", () => {
    const acc = new ChatStreamAccumulator("apply");
    acc.onEvent({
      kind: "tool_use",
      id: "t1",
      name: "Read",
      input: { file_path: "foo.md" },
    });
    const log = acc.finalize();
    expect(log).toHaveLength(1);
    expect(log[0].role).toBe("tool");
    expect(log[0].toolName).toBe("Read");
    expect(log[0].content).toBe("foo.md");
    expect(log[0].toolInput).toBe(JSON.stringify({ file_path: "foo.md" }));
  });

  it("interleaved text→thinking→text produces separate blocks in order", () => {
    const acc = new ChatStreamAccumulator("plan");
    feed(acc, [
      { kind: "text", text: "part1" },
      { kind: "thinking", text: "pondering" },
      { kind: "thinking_done", durationMs: 10 },
      { kind: "text", text: "part2" },
    ]);
    const log = acc.finalize();
    expect(log.map((m) => m.role)).toEqual([
      "assistant",
      "thinking",
      "assistant",
    ]);
    expect(log[0].content).toBe("part1");
    expect(log[1].content).toBe("pondering");
    expect(log[2].content).toBe("part2");
  });

  it("thinking event flushes buffered text first", () => {
    const acc = new ChatStreamAccumulator("plan");
    feed(acc, [
      { kind: "text", text: "first" },
      { kind: "thinking", text: "hmm" },
    ]);
    const log = acc.finalize();
    expect(log[0].role).toBe("assistant");
    expect(log[0].content).toBe("first");
    expect(log[1].role).toBe("thinking");
  });

  it("tool_use flushes buffered text and thinking first", () => {
    const acc = new ChatStreamAccumulator("plan");
    feed(acc, [
      { kind: "thinking", text: "planning" },
      { kind: "text", text: "some text" },
      {
        kind: "tool_use",
        id: "t1",
        name: "Bash",
        input: { command: "ls" },
      },
    ]);
    const log = acc.finalize();
    expect(log.map((m) => m.role)).toEqual(["thinking", "assistant", "tool"]);
  });

  it("in plan mode, a plan tool marks assistant messages as hasPlan", () => {
    const acc = new ChatStreamAccumulator("plan");
    feed(acc, [
      { kind: "text", text: "Here's the plan" },
      {
        kind: "tool_use",
        id: "t1",
        name: "ExitPlanMode",
        input: {},
      },
    ]);
    const log = acc.finalize();
    const assistants = log.filter((m) => m.role === "assistant");
    expect(assistants.length).toBeGreaterThan(0);
    for (const a of assistants) expect(a.hasPlan).toBe(true);
  });

  it("in apply mode, plan tools do NOT set hasPlan", () => {
    const acc = new ChatStreamAccumulator("apply");
    feed(acc, [
      { kind: "text", text: "applying..." },
      { kind: "tool_use", id: "t1", name: "Edit", input: { file_path: "x" } },
    ]);
    const log = acc.finalize();
    const assistants = log.filter((m) => m.role === "assistant");
    for (const a of assistants) expect(a.hasPlan).toBeFalsy();
  });

  it("plan mode without a plan tool leaves hasPlan unset", () => {
    const acc = new ChatStreamAccumulator("plan");
    feed(acc, [
      { kind: "text", text: "just chatting" },
      { kind: "tool_use", id: "t1", name: "Read", input: { file_path: "f" } },
    ]);
    const log = acc.finalize();
    const assistants = log.filter((m) => m.role === "assistant");
    for (const a of assistants) expect(a.hasPlan).toBeFalsy();
  });

  it("finalize on empty stream returns a single '(no response)' assistant", () => {
    const acc = new ChatStreamAccumulator("plan");
    const log = acc.finalize();
    expect(log).toHaveLength(1);
    expect(log[0].role).toBe("assistant");
    expect(log[0].content).toBe("(no response)");
  });

  it("scrubs em-dashes from assistant content", () => {
    const acc = new ChatStreamAccumulator("apply");
    feed(acc, [{ kind: "text", text: "yes — definitely" }]);
    const log = acc.finalize();
    expect(log[0].content).toBe("yes. definitely");
  });

  it("empty text buffer does not emit a blank assistant message", () => {
    const acc = new ChatStreamAccumulator("apply");
    feed(acc, [
      { kind: "text", text: "   " },
      { kind: "tool_use", id: "t1", name: "Read", input: { file_path: "f" } },
    ]);
    const log = acc.finalize();
    // Only the tool message — no blank assistant block.
    const assistants = log.filter((m) => m.role === "assistant");
    expect(assistants).toHaveLength(0);
  });

  it("propagates the mode onto assistant messages", () => {
    const acc = new ChatStreamAccumulator("apply");
    feed(acc, [{ kind: "text", text: "hi" }]);
    const log = acc.finalize();
    expect(log[0].mode).toBe("apply");
  });
});
