import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let workDir: string;
let paths: typeof import("@/server/lib/paths");

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), "jampad-paths-"));
  mkdirSync(join(workDir, "jam"), { recursive: true });
  process.env.JAMPAD_CWD = workDir;
  paths = await import("@/server/lib/paths");
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("safeJoin", () => {
  it("resolves a normal slug under the content root", () => {
    const out = paths.safeJoin("foo", "bar.md");
    expect(
      out.endsWith("/jam/foo/bar.md") || out.endsWith("\\jam\\foo\\bar.md"),
    ).toBe(true);
  });

  it("rejects path traversal via .. segments", () => {
    expect(() => paths.safeJoin("..", "etc", "passwd")).toThrow(/escapes/);
  });

  it("normalizes an absolute-looking segment under the root (path.join semantics)", () => {
    // path.join strips leading slash when it isn't the first segment, so the
    // result resolves under the content root and does not escape.
    const out = paths.safeJoin("/etc/passwd");
    expect(
      out.includes("/jam/etc/passwd") || out.includes("\\jam\\etc\\passwd"),
    ).toBe(true);
  });
});

describe("pathFromSlug / folderFromSlug", () => {
  it("pathFromSlug appends .md to the last segment", () => {
    const out = paths.pathFromSlug(["docs", "intro"]);
    expect(out.endsWith("intro.md")).toBe(true);
  });

  it("folderFromSlug treats every segment as a directory", () => {
    const out = paths.folderFromSlug(["docs", "intro"]);
    expect(out.endsWith("intro")).toBe(true);
    expect(out.endsWith(".md")).toBe(false);
  });

  it("pathFromSlug rejects empty slug", () => {
    expect(() => paths.pathFromSlug([])).toThrow();
  });
});

describe("isHidden", () => {
  it("hides dotfiles", () => {
    expect(paths.isHidden(".env")).toBe(true);
    expect(paths.isHidden(".git")).toBe(true);
  });

  it("hides node_modules and .DS_Store", () => {
    expect(paths.isHidden("node_modules")).toBe(true);
    expect(paths.isHidden(".DS_Store")).toBe(true);
  });

  it("does not hide normal page names", () => {
    expect(paths.isHidden("Welcome.md")).toBe(false);
    expect(paths.isHidden("docs")).toBe(false);
  });
});

describe("slugFromPath ↔ pathFromSlug", () => {
  it("round-trips a slug through path conversion", () => {
    const original = ["docs", "intro"];
    const abs = paths.pathFromSlug(original);
    const round = paths.slugFromPath(abs);
    expect(round).toEqual(original);
  });
});
