import { NextRequest, NextResponse } from "next/server";
import { createChat, listChats } from "@/lib/chats";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

function chatGuard() {
  if (!getConfig().features.chat) {
    return NextResponse.json({ error: "Chat disabled" }, { status: 404 });
  }
  return null;
}

export async function GET() {
  const blocked = chatGuard();
  if (blocked) return blocked;
  const chats = await listChats();
  return NextResponse.json({ chats });
}

export async function POST(req: NextRequest) {
  const blocked = chatGuard();
  if (blocked) return blocked;
  const body = await req.json().catch(() => ({}));
  const chat = await createChat(
    typeof body.title === "string" ? body.title : undefined,
  );
  return NextResponse.json(chat);
}
