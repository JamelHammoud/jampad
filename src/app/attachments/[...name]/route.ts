import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { attachmentsRoot } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

type Ctx = { params: Promise<{ name: string[] }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { name } = await params;
  const root = attachmentsRoot();
  const abs = path.resolve(root, ...name);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return new Response("Not found", { status: 404 });
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
    return new Response("Not found", { status: 404 });
  }
}
