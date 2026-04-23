import { NextRequest, NextResponse } from "next/server";
import { readChat, writeChat } from "@/lib/chats";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  const chat = await readChat(id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  chat.title = (title ?? "").trim() || chat.title;
  chat.updatedAt = new Date().toISOString();
  await writeChat(chat);
  return NextResponse.json({ ok: true });
}
