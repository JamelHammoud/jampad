import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * All handlers eventually call getConfig() which caches the resolved config
 * based on JAMPAD_CWD. Set up a single tmp wiki for the whole suite and use
 * distinct slugs per test to avoid cross-test interference.
 */

let workDir: string;

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), "jampad-mcp-tools-"));
  mkdirSync(join(workDir, "jam"), { recursive: true });
  mkdirSync(join(workDir, "jam", "docs"), { recursive: true });

  // Seed a few pages so list/search/read have something to find.
  writeFileSync(
    join(workDir, "jam", "Welcome.md"),
    "---\ntitle: Welcome\nicon: 👋\n---\n\nHello world\n",
    "utf8",
  );
  writeFileSync(
    join(workDir, "jam", "docs", "intro.md"),
    "---\ntitle: Intro\n---\n\nIntroduction text\n",
    "utf8",
  );

  process.env.JAMPAD_CWD = workDir;
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// Import lazily so JAMPAD_CWD is set before config resolves.
async function loadHandlers() {
  const mod = await import("@/mcp/tools");
  return mod.handlers;
}

describe("search_pages", () => {
  it("returns all pages when query is empty", async () => {
    const { search_pages } = await loadHandlers();
    const res = await search_pages({ query: "" });
    const payload = JSON.parse(res.content[0].text);
    const titles = payload.results.map((r: { title: string }) => r.title);
    expect(titles).toContain("Welcome");
    expect(titles).toContain("Intro");
  });

  it("fuzzy-matches a query against title", async () => {
    const { search_pages } = await loadHandlers();
    const res = await search_pages({ query: "welcome" });
    const payload = JSON.parse(res.content[0].text);
    expect(payload.results.length).toBeGreaterThan(0);
    expect(payload.results[0].title).toBe("Welcome");
  });

  it("respects the limit parameter", async () => {
    const { search_pages } = await loadHandlers();
    const res = await search_pages({ query: "", limit: 1 });
    const payload = JSON.parse(res.content[0].text);
    expect(payload.results).toHaveLength(1);
  });
});

describe("list_pages", () => {
  it("returns the full tree from root when folderSlug is omitted", async () => {
    const { list_pages } = await loadHandlers();
    const res = await list_pages({});
    const payload = JSON.parse(res.content[0].text);
    expect(Array.isArray(payload.tree)).toBe(true);
    const names = payload.tree.map((n: { name: string }) => n.name);
    expect(names).toContain("Welcome");
    expect(names).toContain("docs");
  });

  it("returns a subtree when folderSlug is provided", async () => {
    const { list_pages } = await loadHandlers();
    const res = await list_pages({ folderSlug: ["docs"] });
    const payload = JSON.parse(res.content[0].text);
    const names = payload.tree.map((n: { name: string }) => n.name);
    expect(names).toContain("intro");
  });
});

describe("read_page", () => {
  it("returns the page payload for a valid slug", async () => {
    const { read_page } = await loadHandlers();
    const res = await read_page({ slug: ["Welcome"] });
    const payload = JSON.parse(res.content[0].text);
    expect(payload.title).toBe("Welcome");
    expect(payload.icon).toBe("👋");
    expect(payload.markdown).toContain("Hello world");
  });

  it("throws on missing page", async () => {
    const { read_page } = await loadHandlers();
    await expect(read_page({ slug: ["does-not-exist"] })).rejects.toThrow(
      /not found/i,
    );
  });

  it("throws on empty slug", async () => {
    const { read_page } = await loadHandlers();
    await expect(read_page({ slug: [] })).rejects.toThrow();
  });
});

describe("create_page + update_page", () => {
  it("creates a new page with title and optional markdown", async () => {
    const { create_page, read_page } = await loadHandlers();
    const res = await create_page({
      title: "New Thing",
      markdown: "body body",
    });
    const payload = JSON.parse(res.content[0].text);
    expect(payload.slug[payload.slug.length - 1]).toBe("New-Thing");
    expect(payload.title).toBe("New Thing");

    const read = await read_page({ slug: payload.slug });
    const readPayload = JSON.parse(read.content[0].text);
    expect(readPayload.markdown).toContain("body body");
    expect(readPayload.title).toBe("New Thing");
  });

  it("rejects empty title", async () => {
    const { create_page } = await loadHandlers();
    await expect(create_page({ title: "   " })).rejects.toThrow();
  });

  it("updates specific fields while preserving the rest", async () => {
    const { create_page, update_page, read_page } = await loadHandlers();
    const created = await create_page({
      title: "Patch Target",
      markdown: "original",
    });
    const slug = JSON.parse(created.content[0].text).slug;

    await update_page({ slug, markdown: "updated body" });

    const read = await read_page({ slug });
    const payload = JSON.parse(read.content[0].text);
    expect(payload.markdown).toContain("updated body");
    expect(payload.title).toBe("Patch Target"); // preserved
  });

  it("clears icon when null is explicitly passed", async () => {
    const { create_page, update_page, read_page } = await loadHandlers();
    const created = await create_page({
      title: "Iconed",
      markdown: "x",
    });
    const slug = JSON.parse(created.content[0].text).slug;

    await update_page({ slug, icon: "🎉" });
    let read = JSON.parse((await read_page({ slug })).content[0].text);
    expect(read.icon).toBe("🎉");

    await update_page({ slug, icon: null });
    read = JSON.parse((await read_page({ slug })).content[0].text);
    expect(read.icon).toBeUndefined();
  });

  it("update_page throws on missing page", async () => {
    const { update_page } = await loadHandlers();
    await expect(
      update_page({ slug: ["nope"], markdown: "x" }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("rename_page", () => {
  it("renames a page and preserves its content", async () => {
    const { create_page, rename_page, read_page } = await loadHandlers();
    const created = await create_page({
      title: "Rename Me",
      markdown: "keep this",
    });
    const fromSlug = JSON.parse(created.content[0].text).slug;
    const toSlug = [...fromSlug.slice(0, -1), "renamed"];

    await rename_page({ fromSlug, toSlug });

    const read = await read_page({ slug: toSlug });
    const payload = JSON.parse(read.content[0].text);
    expect(payload.markdown).toContain("keep this");

    await expect(read_page({ slug: fromSlug })).rejects.toThrow(/not found/i);
  });
});

describe("delete_page", () => {
  it("deletes a single page file", async () => {
    const { create_page, delete_page, read_page } = await loadHandlers();
    const created = await create_page({
      title: "Delete Me",
      markdown: "gone soon",
    });
    const slug = JSON.parse(created.content[0].text).slug;

    // Confirm file exists on disk before delete.
    expect(existsSync(join(workDir, "jam", `${slug.join("/")}.md`))).toBe(true);

    await delete_page({ slug });

    await expect(read_page({ slug })).rejects.toThrow(/not found/i);
  });

  it("recursively deletes a folder at the given slug", async () => {
    mkdirSync(join(workDir, "jam", "trash-folder"), { recursive: true });
    writeFileSync(
      join(workDir, "jam", "trash-folder", "child.md"),
      "---\ntitle: Child\n---\n\nchild body\n",
      "utf8",
    );

    const { delete_page } = await loadHandlers();
    await delete_page({ slug: ["trash-folder"] });

    expect(existsSync(join(workDir, "jam", "trash-folder"))).toBe(false);
  });

  it("throws on empty slug", async () => {
    const { delete_page } = await loadHandlers();
    await expect(delete_page({ slug: [] })).rejects.toThrow();
  });
});

// Sanity: the tool mutations above persist to disk through the public API.
describe("disk round-trip", () => {
  it("writes gray-matter frontmatter the way readPage expects", async () => {
    const { create_page } = await loadHandlers();
    const created = await create_page({
      title: "Gray Matter Check",
      markdown: "just checking",
    });
    const slug = JSON.parse(created.content[0].text).slug;
    const abs = join(workDir, "jam", `${slug.join("/")}.md`);
    const raw = readFileSync(abs, "utf8");
    expect(raw).toMatch(/^---\n/);
    expect(raw).toContain("title: Gray Matter Check");
    expect(raw).toContain("just checking");
  });
});
