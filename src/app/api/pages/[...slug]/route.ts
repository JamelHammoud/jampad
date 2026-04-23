import { NextRequest, NextResponse } from "next/server";
import {
  deleteFolder,
  deletePage,
  readPage,
  renamePage,
  writePage,
} from "@/lib/fs";
import { folderFromSlug } from "@/lib/paths";
import { promises as fs } from "node:fs";

type Ctx = { params: Promise<{ slug: string[] }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const page = await readPage(slug);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(page);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { title, icon, cover, markdown } = body as {
    title?: string;
    icon?: string | null;
    cover?: string | null;
    markdown?: string;
  };
  if (typeof markdown !== "string") {
    return NextResponse.json({ error: "Missing markdown" }, { status: 400 });
  }
  await writePage(slug, {
    title: title ?? undefined,
    icon: icon ?? null,
    cover: cover ?? null,
    markdown,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
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
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { toSlug } = body as { toSlug?: string[] };
  if (!Array.isArray(toSlug) || toSlug.length === 0) {
    return NextResponse.json({ error: "Missing toSlug" }, { status: 400 });
  }
  try {
    await renamePage(slug, toSlug);
    return NextResponse.json({ slug: toSlug });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rename failed" },
      { status: 400 },
    );
  }
}
