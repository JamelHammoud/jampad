import { NextRequest, NextResponse } from "next/server";
import { createFolder, createPage } from "@/lib/fs";
import { humanize } from "@/lib/humanize";
import { slugifyFileName } from "@/lib/slug";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { parentSlug, title, kind } = body as {
    parentSlug?: string[];
    title?: string;
    kind?: "page" | "folder";
  };

  const parent = Array.isArray(parentSlug) ? parentSlug.filter(Boolean) : [];
  const rawTitle = (title ?? "").trim() || "Untitled";
  const fileName = slugifyFileName(rawTitle);

  try {
    if (kind === "folder") {
      await createFolder([...parent, fileName]);
      return NextResponse.json({
        slug: [...parent, fileName],
        title: humanize(fileName),
        kind: "folder",
      });
    }
    const slug = [...parent, fileName];
    await createPage(slug, rawTitle);
    return NextResponse.json({ slug, title: rawTitle, kind: "page" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create" },
      { status: 400 },
    );
  }
}
