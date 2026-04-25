import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Hono } from "hono";

/**
 * Integration test for the Hono app: drives every API route via app.fetch()
 * against a temp wiki directory. This is the safety net for the Next.js →
 * Hono migration — if a route's contract drifts, this test catches it.
 *
 * getConfig() caches based on JAMPAD_CWD, so the suite shares one tmp dir.
 */

let workDir: string;
let app: Hono;

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), "jampad-server-routes-"));
  mkdirSync(join(workDir, "jam"), { recursive: true });
  writeFileSync(
    join(workDir, "jam", "Welcome.md"),
    "---\ntitle: Welcome\nicon: 👋\n---\n\nHello world\n",
    "utf8",
  );
  process.env.JAMPAD_CWD = workDir;

  // Import lazily so JAMPAD_CWD is set before config resolves.
  const { createApp } = await import("@/server/createApp");
  app = createApp({});
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function req(method: string, url: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "content-type": "application/json" };
  }
  return new Request(`http://localhost${url}`, init);
}

describe("/api/config", () => {
  it("returns the resolved client config", async () => {
    const res = await app.fetch(req("GET", "/api/config"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      branding: { name: string };
      features: { sidebar: boolean };
      themeCss: string;
    };
    expect(data.branding.name).toBeDefined();
    expect(data.features.sidebar).toBe(true);
    expect(data.themeCss).toContain("--fg:");
  });
});

describe("/api/tree", () => {
  it("returns sections including the seeded Welcome page", async () => {
    const res = await app.fetch(req("GET", "/api/tree"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      sections: { tree: { name: string }[] }[];
    };
    const names = data.sections.flatMap((s) => s.tree.map((n) => n.name));
    expect(names).toContain("Welcome");
  });
});

describe("/api/pages", () => {
  it("creates a page and reads it back", async () => {
    const create = await app.fetch(
      req("POST", "/api/pages", {
        parentSlug: [],
        title: "Routes Test",
        kind: "page",
      }),
    );
    expect(create.status).toBe(200);
    const created = (await create.json()) as { slug: string[]; title: string };
    expect(created.slug[created.slug.length - 1]).toBe("Routes-Test");

    const get = await app.fetch(
      req(
        "GET",
        "/api/pages/" + created.slug.map(encodeURIComponent).join("/"),
      ),
    );
    expect(get.status).toBe(200);
    const page = (await get.json()) as { title: string };
    expect(page.title).toBe("Routes Test");
  });

  it("creates a folder via kind: folder", async () => {
    const res = await app.fetch(
      req("POST", "/api/pages", {
        parentSlug: [],
        title: "MyFolder",
        kind: "folder",
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { kind: string };
    expect(data.kind).toBe("folder");
  });

  it("rejects an invalid POST body", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/pages", {
        method: "POST",
        body: "not json",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("PUT updates a page's markdown and frontmatter", async () => {
    const create = await app.fetch(
      req("POST", "/api/pages", {
        parentSlug: [],
        title: "ToUpdate",
        kind: "page",
      }),
    );
    const { slug } = (await create.json()) as { slug: string[] };

    const put = await app.fetch(
      req("PUT", "/api/pages/" + slug.map(encodeURIComponent).join("/"), {
        title: "Updated Title",
        icon: "✨",
        cover: null,
        markdown: "fresh body",
      }),
    );
    expect(put.status).toBe(200);

    const get = await app.fetch(
      req("GET", "/api/pages/" + slug.map(encodeURIComponent).join("/")),
    );
    const page = (await get.json()) as {
      title: string;
      icon?: string;
      markdown: string;
    };
    expect(page.title).toBe("Updated Title");
    expect(page.icon).toBe("✨");
    expect(page.markdown).toContain("fresh body");
  });

  it("PATCH renames a page to a new slug", async () => {
    const create = await app.fetch(
      req("POST", "/api/pages", {
        parentSlug: [],
        title: "Before",
        kind: "page",
      }),
    );
    const { slug } = (await create.json()) as { slug: string[] };

    const patch = await app.fetch(
      req("PATCH", "/api/pages/" + slug.map(encodeURIComponent).join("/"), {
        toSlug: ["After"],
      }),
    );
    expect(patch.status).toBe(200);

    const oldGet = await app.fetch(
      req("GET", "/api/pages/" + slug.map(encodeURIComponent).join("/")),
    );
    expect(oldGet.status).toBe(404);

    const newGet = await app.fetch(req("GET", "/api/pages/After"));
    expect(newGet.status).toBe(200);
  });

  it("DELETE removes a page", async () => {
    const create = await app.fetch(
      req("POST", "/api/pages", {
        parentSlug: [],
        title: "ToDelete",
        kind: "page",
      }),
    );
    const { slug } = (await create.json()) as { slug: string[] };

    const del = await app.fetch(
      req("DELETE", "/api/pages/" + slug.map(encodeURIComponent).join("/")),
    );
    expect(del.status).toBe(200);

    const get = await app.fetch(
      req("GET", "/api/pages/" + slug.map(encodeURIComponent).join("/")),
    );
    expect(get.status).toBe(404);
  });

  it("GET returns 404 for a missing slug", async () => {
    const res = await app.fetch(req("GET", "/api/pages/does-not-exist"));
    expect(res.status).toBe(404);
  });
});

describe("/api/search", () => {
  it("returns all pages on empty query", async () => {
    const res = await app.fetch(req("GET", "/api/search?q="));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { results: { title: string }[] };
    expect(data.results.length).toBeGreaterThan(0);
    const titles = data.results.map((r) => r.title);
    expect(titles).toContain("Welcome");
  });

  it("fuzzy-matches a query", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=welcome"));
    const data = (await res.json()) as { results: { title: string }[] };
    expect(data.results[0].title).toBe("Welcome");
  });
});

describe("/api/chats (gated by features.chat)", () => {
  it("returns 404 when chat is disabled in config", async () => {
    const res = await app.fetch(req("GET", "/api/chats"));
    expect(res.status).toBe(404);
  });
});
