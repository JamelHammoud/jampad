import { describe, it, expect } from "vitest";
import { serializeMessages, parseMessages } from "@/lib/chats";
import type { ChatMessage } from "@/lib/types";

function roundTrip(messages: ChatMessage[]): ChatMessage[] {
  return parseMessages(serializeMessages(messages));
}

describe("chats serializer round-trip", () => {
  it("round-trips user + assistant messages", () => {
    const input: ChatMessage[] = [
      { role: "user", content: "Hello", createdAt: "2026-01-01T00:00:00Z" },
      {
        role: "assistant",
        content: "Hi there",
        mode: "apply",
        createdAt: "2026-01-01T00:00:01Z",
      },
    ];
    const out = roundTrip(input);
    expect(out).toHaveLength(2);
    expect(out[0].role).toBe("user");
    expect(out[0].content).toBe("Hello");
    expect(out[1].role).toBe("assistant");
    expect(out[1].content).toBe("Hi there");
    expect(out[1].mode).toBe("apply");
  });

  it("round-trips assistant with hasPlan flag", () => {
    const input: ChatMessage[] = [
      {
        role: "assistant",
        content: "plan contents",
        mode: "plan",
        hasPlan: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    const out = roundTrip(input);
    expect(out[0].hasPlan).toBe(true);
  });

  it("round-trips thinking messages with thinkingMs", () => {
    const input: ChatMessage[] = [
      {
        role: "thinking",
        content: "deep thought",
        thinkingMs: 4200,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    const out = roundTrip(input);
    expect(out[0].role).toBe("thinking");
    expect(out[0].content).toBe("deep thought");
    expect(out[0].thinkingMs).toBe(4200);
  });

  it("round-trips tool messages with toolName and toolInput", () => {
    const input: ChatMessage[] = [
      {
        role: "tool",
        content: "src/app.ts",
        toolName: "Read",
        toolInput: JSON.stringify({ file_path: "src/app.ts" }),
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    const out = roundTrip(input);
    expect(out[0].role).toBe("tool");
    expect(out[0].toolName).toBe("Read");
    expect(out[0].content).toBe("src/app.ts");
    expect(out[0].toolInput).toBe(JSON.stringify({ file_path: "src/app.ts" }));
  });

  it("preserves createdAt from the serialized timestamp comment", () => {
    const input: ChatMessage[] = [
      {
        role: "user",
        content: "test",
        createdAt: "2026-04-22T15:30:00Z",
      },
    ];
    const out = roundTrip(input);
    expect(out[0].createdAt).toBe("2026-04-22T15:30:00Z");
  });

  it("round-trips an interleaved multi-message conversation", () => {
    const input: ChatMessage[] = [
      { role: "user", content: "What is X?", createdAt: "t1" },
      {
        role: "thinking",
        content: "pondering",
        thinkingMs: 800,
        createdAt: "t2",
      },
      {
        role: "tool",
        content: "pattern in src",
        toolName: "Grep",
        toolInput: JSON.stringify({ pattern: "X", path: "src" }),
        createdAt: "t3",
      },
      {
        role: "assistant",
        content: "X is Y",
        mode: "apply",
        createdAt: "t4",
      },
    ];
    const out = roundTrip(input);
    expect(out.map((m) => m.role)).toEqual([
      "user",
      "thinking",
      "tool",
      "assistant",
    ]);
    expect(out[0].content).toBe("What is X?");
    expect(out[1].thinkingMs).toBe(800);
    expect(out[2].toolName).toBe("Grep");
    expect(out[3].mode).toBe("apply");
  });
});
