import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  attachmentsRoot,
  attachmentsUrlPrefix,
  contentRoot,
  folderFromSlug,
  isHidden,
  pathFromSlug,
  slugFromPath,
} from "./paths";
import { getConfig } from "./config";
import type { PageData, TreeNode } from "./types";
import { humanize } from "./humanize";

export async function ensureWikiRoot(): Promise<void> {
  await fs.mkdir(contentRoot(), { recursive: true });
}

async function safeStat(p: string) {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

export async function buildTree(rootSlug: string[] = []): Promise<TreeNode[]> {
  const absRoot = rootSlug.length ? folderFromSlug(rootSlug) : contentRoot();
  const stat = await safeStat(absRoot);
  if (!stat || !stat.isDirectory()) return [];

  const entries = await fs.readdir(absRoot, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  for (const entry of entries) {
    if (isHidden(entry.name)) continue;

    if (entry.isDirectory()) {
      const folderSlug = [...rootSlug, entry.name];
      const children = await buildTree(folderSlug);
      nodes.push({
        kind: "folder",
        slug: folderSlug,
        name: entry.name,
        title: humanize(entry.name),
        children,
      });
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const fileSlug = [...rootSlug, entry.name.slice(0, -3)];
      const abs = path.join(absRoot, entry.name);
      const { title, icon } = await readPageMeta(
        abs,
        fileSlug[fileSlug.length - 1],
      );
      nodes.push({
        kind: "page",
        slug: fileSlug,
        name: fileSlug[fileSlug.length - 1],
        title,
        icon,
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
  return nodes;
}

async function readPageMeta(
  absPath: string,
  fallback: string,
): Promise<{ title: string; icon?: string }> {
  try {
    const raw = await fs.readFile(absPath, "utf8");
    const parsed = matter(raw);
    const frontTitle =
      typeof parsed.data.title === "string" ? parsed.data.title.trim() : "";
    const icon =
      typeof parsed.data.icon === "string" && parsed.data.icon.trim()
        ? parsed.data.icon.trim()
        : undefined;
    if (frontTitle) return { title: frontTitle, icon };
    const firstHeading = parsed.content.match(/^#\s+(.+)$/m);
    if (firstHeading) return { title: firstHeading[1].trim(), icon };
    return { title: humanize(fallback), icon };
  } catch {
    return { title: humanize(fallback) };
  }
}

export async function readPage(slug: string[]): Promise<PageData | null> {
  const abs = pathFromSlug(slug);
  const stat = await safeStat(abs);
  if (!stat || !stat.isFile()) return null;
  const raw = await fs.readFile(abs, "utf8");
  const parsed = matter(raw);
  return {
    slug,
    title:
      (typeof parsed.data.title === "string" && parsed.data.title.trim()) ||
      humanize(slug[slug.length - 1]),
    icon: typeof parsed.data.icon === "string" ? parsed.data.icon : undefined,
    cover:
      typeof parsed.data.cover === "string" ? parsed.data.cover : undefined,
    markdown: parsed.content.replace(/^\n+/, ""),
    updatedAt: stat.mtime.toISOString(),
  };
}

export async function writePage(
  slug: string[],
  data: {
    title?: string;
    icon?: string | null;
    cover?: string | null;
    markdown: string;
  },
): Promise<void> {
  const abs = pathFromSlug(slug);
  await fs.mkdir(path.dirname(abs), { recursive: true });

  const front: Record<string, unknown> = {};
  if (data.title && data.title.trim()) front.title = data.title.trim();
  if (data.icon) front.icon = data.icon;
  if (data.cover) front.cover = data.cover;

  const body = data.markdown.replace(/^\n+/, "");
  const out = Object.keys(front).length
    ? matter.stringify(body, front)
    : body + (body.endsWith("\n") ? "" : "\n");
  await fs.writeFile(abs, out, "utf8");
}

export async function createPage(slug: string[], title: string): Promise<void> {
  const abs = pathFromSlug(slug);
  const existing = await safeStat(abs);
  if (existing) throw new Error("Page already exists");
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const body = matter.stringify("", { title });
  await fs.writeFile(abs, body, "utf8");
}

export async function createFolder(slug: string[]): Promise<void> {
  const abs = folderFromSlug(slug);
  await fs.mkdir(abs, { recursive: true });
}

export async function deletePage(slug: string[]): Promise<void> {
  const abs = pathFromSlug(slug);
  await fs.rm(abs, { force: true });
}

export async function deleteFolder(slug: string[]): Promise<void> {
  const abs = folderFromSlug(slug);
  await fs.rm(abs, { recursive: true, force: true });
}

export async function renamePage(
  fromSlug: string[],
  toSlug: string[],
): Promise<void> {
  const from = pathFromSlug(fromSlug);
  const to = pathFromSlug(toSlug);
  if (from === to) return;
  const exists = await safeStat(to);
  if (exists) throw new Error("Destination already exists");
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
}

export async function listAllPagesFlat(): Promise<
  { slug: string[]; title: string; markdown: string }[]
> {
  const out: { slug: string[]; title: string; markdown: string }[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (isHidden(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const slug = slugFromPath(abs);
        const raw = await fs.readFile(abs, "utf8").catch(() => "");
        const parsed = matter(raw);
        const title =
          (typeof parsed.data.title === "string" && parsed.data.title.trim()) ||
          humanize(slug[slug.length - 1]);
        out.push({ slug, title, markdown: parsed.content });
      }
    }
  }
  await walk(contentRoot());
  return out;
}

export function uploadsDir(): string {
  return attachmentsRoot();
}

export async function saveUpload(
  buf: Buffer,
  filename: string,
  mimeType?: string,
): Promise<string> {
  const cfg = getConfig();
  if (buf.byteLength > cfg.uploads.maxBytes) {
    throw new Error(`Upload exceeds max size of ${cfg.uploads.maxBytes} bytes`);
  }
  if (mimeType && !isAllowed(mimeType, cfg.uploads.allowedTypes)) {
    throw new Error(`Upload type ${mimeType} not allowed`);
  }
  const dir = attachmentsRoot();
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(filename) || ".bin";
  const base = path
    .basename(filename, ext)
    .replace(/[^a-z0-9-_]+/gi, "-")
    .toLowerCase()
    .slice(0, 40);
  const name = `${base}-${Date.now().toString(36)}${ext}`;
  await fs.writeFile(path.join(dir, name), buf);
  return `${attachmentsUrlPrefix()}${name}`;
}

function isAllowed(mime: string, allowed: string[]): boolean {
  for (const pattern of allowed) {
    if (pattern === mime) return true;
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1);
      if (mime.startsWith(prefix)) return true;
    }
  }
  return false;
}
