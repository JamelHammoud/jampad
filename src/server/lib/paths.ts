import path from "node:path";
import { getConfig } from "./config";

export function contentRoot(): string {
  return getConfig().content.dir;
}

export function attachmentsRoot(): string {
  return getConfig().uploads.dir;
}

export function attachmentsUrlPrefix(): string {
  return getConfig().uploads.urlPrefix;
}

export function chatsRoot(): string {
  return getConfig().chats.dir;
}

export function drawingsRoot(): string {
  return getConfig().drawings.dir;
}

export function consumerRoot(): string {
  return getConfig().cwd;
}

const BUILTIN_IGNORED = new Set<string>([
  "node_modules",
  ".git",
  ".DS_Store",
  ".next",
]);

export function safeJoin(...segments: string[]): string {
  const root = contentRoot();
  const joined = path.join(root, ...segments);
  const resolved = path.resolve(joined);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Path escapes content root");
  }
  return resolved;
}

export function slugFromPath(filePath: string): string[] {
  const rel = path.relative(contentRoot(), filePath);
  const withoutExt = rel.endsWith(".md") ? rel.slice(0, -3) : rel;
  return withoutExt.split(path.sep).filter(Boolean);
}

export function pathFromSlug(slug: string[]): string {
  if (slug.length === 0) throw new Error("Empty slug");
  return safeJoin(...slug.slice(0, -1), `${slug[slug.length - 1]}.md`);
}

export function folderFromSlug(slug: string[]): string {
  return safeJoin(...slug);
}

export function isHidden(name: string): boolean {
  if (name.startsWith(".")) return true;
  if (BUILTIN_IGNORED.has(name)) return true;
  const cfg = getConfig();
  if (cfg.content.hiddenFiles.includes(name)) return true;
  const attachRel = path.relative(cfg.content.dir, cfg.uploads.dir);
  if (!attachRel.startsWith("..") && attachRel.split(path.sep)[0] === name) {
    return true;
  }
  return false;
}
