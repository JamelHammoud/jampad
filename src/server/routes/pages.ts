import { Hono } from "hono";
import { promises as fs } from "node:fs";
import {
  createFolder,
  createPage,
  deleteFolder,
  deletePage,
  readPage,
  renamePage,
  writePage,
} from "@/server/lib/fs";
import { folderFromSlug } from "@/server/lib/paths";
import { humanize } from "@/shared/humanize";
import { slugifyFileName } from "@/shared/slug";

export const pagesRoute = new Hono();

pagesRoute.post("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    parentSlug?: string[];
    title?: string;
    kind?: "page" | "folder";
  } | null;
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid body" }, 400);
  }

  const parent = Array.isArray(body.parentSlug)
    ? body.parentSlug.filter(Boolean)
    : [];
  const rawTitle = (body.title ?? "").trim() || "Untitled";
  const fileName = slugifyFileName(rawTitle);

  try {
    if (body.kind === "folder") {
      await createFolder([...parent, fileName]);
      return c.json({
        slug: [...parent, fileName],
        title: humanize(fileName),
        kind: "folder",
      });
    }
    const slug = [...parent, fileName];
    await createPage(slug, rawTitle);
    return c.json({ slug, title: rawTitle, kind: "page" });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Failed to create" },
      400,
    );
  }
});

pagesRoute.get("/:slug{.+}", async (c) => {
  const slug = c.req.param("slug").split("/").map(decodeURIComponent);
  const page = await readPage(slug);
  if (!page) return c.json({ error: "Not found" }, 404);
  return c.json(page);
});

pagesRoute.put("/:slug{.+}", async (c) => {
  const slug = c.req.param("slug").split("/").map(decodeURIComponent);
  const body = (await c.req.json().catch(() => null)) as {
    title?: string;
    icon?: string | null;
    cover?: string | null;
    markdown?: string;
  } | null;
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid body" }, 400);
  }
  if (typeof body.markdown !== "string") {
    return c.json({ error: "Missing markdown" }, 400);
  }
  await writePage(slug, {
    title: body.title ?? undefined,
    icon: body.icon ?? null,
    cover: body.cover ?? null,
    markdown: body.markdown,
  });
  return c.json({ ok: true });
});

pagesRoute.delete("/:slug{.+}", async (c) => {
  const slug = c.req.param("slug").split("/").map(decodeURIComponent);
  const abs = folderFromSlug(slug);
  try {
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) {
      await deleteFolder(slug);
    } else {
      await deletePage(slug);
    }
  } catch {
    await deletePage(slug);
  }
  return c.json({ ok: true });
});

pagesRoute.patch("/:slug{.+}", async (c) => {
  const slug = c.req.param("slug").split("/").map(decodeURIComponent);
  const body = (await c.req.json().catch(() => null)) as {
    toSlug?: string[];
  } | null;
  if (!body || !Array.isArray(body.toSlug) || body.toSlug.length === 0) {
    return c.json({ error: "Missing toSlug" }, 400);
  }
  try {
    await renamePage(slug, body.toSlug);
    return c.json({ slug: body.toSlug });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Rename failed" },
      400,
    );
  }
});
