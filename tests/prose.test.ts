import { describe, it, expect } from "vitest";
import { scrubLlmProse } from "@/lib/prose";

describe("scrubLlmProse", () => {
  it("rewrites spaced em-dashes as periods", () => {
    expect(scrubLlmProse("this — that")).toBe("this. that");
  });

  it("rewrites bare em-dashes as commas", () => {
    expect(scrubLlmProse("a—b")).toBe("a, b");
  });

  it("leaves text without em-dashes untouched", () => {
    expect(scrubLlmProse("hello world")).toBe("hello world");
  });

  it("handles multiple em-dashes in one string", () => {
    expect(scrubLlmProse("one — two — three")).toBe("one. two. three");
  });

  it("handles mixed styles", () => {
    expect(scrubLlmProse("foo — bar, baz—qux")).toBe("foo. bar, baz, qux");
  });
});
