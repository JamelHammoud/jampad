import { describe, it, expect } from "vitest";
import { humanize } from "@/lib/humanize";

describe("humanize", () => {
  it("converts kebab-case to Title Case", () => {
    expect(humanize("getting-started")).toBe("Getting Started");
  });

  it("converts snake_case to Title Case", () => {
    expect(humanize("quick_start_guide")).toBe("Quick Start Guide");
  });

  it("handles mixed separators", () => {
    expect(humanize("foo-bar_baz")).toBe("Foo Bar Baz");
  });

  it("collapses consecutive separators", () => {
    expect(humanize("a--b__c")).toBe("A B C");
  });

  it("trims leading/trailing whitespace", () => {
    expect(humanize("  hello-world  ")).toBe("Hello World");
  });

  it("preserves already-capitalized words", () => {
    expect(humanize("API-docs")).toBe("API Docs");
  });

  it("handles single words", () => {
    expect(humanize("welcome")).toBe("Welcome");
  });
});
