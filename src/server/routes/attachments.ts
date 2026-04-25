import { Hono } from "hono";
import { promises as fs } from "node:fs";
import path from "node:path";
import { attachmentsRoot } from "@/server/lib/paths";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

export const attachmentsRoute = new Hono();

attachmentsRoute.get("/:name{.+}", async (c) => {
  const name = c.req.param("name").split("/").map(decodeURIComponent);
  const root = attachmentsRoot();
  const abs = path.resolve(root, ...name);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return c.text("Not found", 404);
  }
  try {
    const data = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return c.text("Not found", 404);
  }
});
