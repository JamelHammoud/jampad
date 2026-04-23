import { NextRequest, NextResponse } from "next/server";
import { saveUpload } from "@/lib/fs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const url = await saveUpload(buffer, file.name, file.type);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
