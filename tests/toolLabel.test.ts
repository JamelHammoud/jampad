import { describe, it, expect } from "vitest";
import { summarizeTool } from "@/lib/toolLabel";

describe("summarizeTool", () => {
  it("returns file_path for Read/Write/Edit/MultiEdit/NotebookEdit", () => {
    for (const name of ["Read", "Write", "Edit", "MultiEdit", "NotebookEdit"]) {
      expect(summarizeTool(name, { file_path: "src/app.ts" })).toBe(
        "src/app.ts",
      );
    }
  });

  it("returns 'file' placeholder when file_path missing", () => {
    expect(summarizeTool("Read", {})).toBe("file");
  });

  it("summarizes Glob with pattern", () => {
    expect(summarizeTool("Glob", { pattern: "**/*.ts" })).toBe("**/*.ts");
  });

  it("summarizes Grep with pattern and path", () => {
    expect(summarizeTool("Grep", { pattern: "TODO", path: "src" })).toBe(
      "TODO  in  src",
    );
  });

  it("summarizes Grep with only pattern", () => {
    expect(summarizeTool("Grep", { pattern: "TODO" })).toBe("TODO");
  });

  it("takes first line of Bash command", () => {
    expect(summarizeTool("Bash", { command: "echo hi\nls -la\npwd" })).toBe(
      "echo hi",
    );
  });

  it("returns url for WebFetch and query for WebSearch", () => {
    expect(summarizeTool("WebFetch", { url: "https://x.com" })).toBe(
      "https://x.com",
    );
    expect(summarizeTool("WebSearch", { query: "foo bar" })).toBe("foo bar");
  });

  it("returns fixed labels for TodoWrite and ExitPlanMode", () => {
    expect(summarizeTool("TodoWrite", {})).toBe("update todos");
    expect(summarizeTool("ExitPlanMode", {})).toBe("done planning");
  });

  it("falls back to common input keys for unknown tools", () => {
    expect(summarizeTool("MyCustom", { file_path: "foo.md" })).toBe("foo.md");
    expect(summarizeTool("MyCustom", { query: "hi" })).toBe("hi");
    expect(summarizeTool("MyCustom", {})).toBe("mycustom");
  });

  it("truncates values at 80 chars", () => {
    const long = "x".repeat(120);
    const result = summarizeTool("Read", { file_path: long });
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.endsWith("…")).toBe(true);
  });
});
