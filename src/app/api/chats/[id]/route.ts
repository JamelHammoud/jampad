import { NextRequest, NextResponse } from "next/server";
import { deleteChat, readChat } from "@/lib/chats";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const chat = await readChat(id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(chat);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await deleteChat(id);
  return NextResponse.json({ ok: true });
}
