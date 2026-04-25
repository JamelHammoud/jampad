import { Hono } from "hono";
import path from "node:path";
import { promises as fsp } from "node:fs";
import { pagesRoute } from "./routes/pages";
import { treeRoute } from "./routes/tree";
import { searchRoute } from "./routes/search";
import { chatsRoute } from "./routes/chats";
import { uploadsRoute } from "./routes/uploads";
import { attachmentsRoute } from "./routes/attachments";
import { configRoute } from "./routes/config";
import { EMBEDDED_ASSETS } from "./embedded-assets";

export type CreateAppOptions = {
  // Absolute path to dist/client. When omitted, the app only mounts API
  // routes — Vite owns the static surface in dev. When EMBEDDED_ASSETS is
  // populated (compiled binary), staticRoot is ignored.
  staticRoot?: string;
};

export function createApp(opts: CreateAppOptions = {}) {
  const app = new Hono();

  app.route("/api/config", configRoute);
  app.route("/api/pages", pagesRoute);
  app.route("/api/tree", treeRoute);
  app.route("/api/search", searchRoute);
  app.route("/api/chats", chatsRoute);
  app.route("/api/uploads", uploadsRoute);
  app.route("/attachments", attachmentsRoute);

  if (EMBEDDED_ASSETS) {
    mountEmbedded(app, EMBEDDED_ASSETS);
  } else if (opts.staticRoot) {
    mountFilesystem(app, opts.staticRoot);
  }

  return app;
}

function mountEmbedded(app: Hono, assets: Map<string, string>) {
  app.get("/*", async (c, next) => {
    const url = new URL(c.req.url);
    const key = url.pathname === "/" ? "/index.html" : url.pathname;
    const embeddedPath = assets.get(key);
    if (!embeddedPath) return next();
    // Bun.file() resolves embedded virtual paths in compiled binaries.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Bun = (globalThis as any).Bun;
    const file = Bun.file(embeddedPath);
    return new Response(file, {
      headers: { "Content-Type": guessMime(key) },
    });
  });
  // SPA fallback: any unmatched path → index.html.
  app.get("*", async () => {
    const indexPath = assets.get("/index.html");
    if (!indexPath) return new Response("missing index.html", { status: 500 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Bun = (globalThis as any).Bun;
    return new Response(Bun.file(indexPath), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });
}

function mountFilesystem(app: Hono, root: string) {
  app.get("/*", async (c, next) => {
    const url = new URL(c.req.url);
    if (url.pathname.includes("..")) return c.text("Not found", 404);
    const tryPath = path.join(root, url.pathname);
    try {
      const stat = await fsp.stat(tryPath);
      if (stat.isFile()) {
        const buf = await fsp.readFile(tryPath);
        return new Response(new Uint8Array(buf), {
          headers: { "Content-Type": guessMime(tryPath) },
        });
      }
    } catch {
      /* fall through */
    }
    return next();
  });
  app.get("*", async (c) => {
    try {
      const html = await fsp.readFile(path.join(root, "index.html"), "utf8");
      return c.html(html);
    } catch {
      return c.text("Not built. Run `jampad build` first.", 500);
    }
  });
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

function guessMime(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}
