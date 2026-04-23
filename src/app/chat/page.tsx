import { notFound, redirect } from "next/navigation";
import { createChat, listChats } from "@/lib/chats";
import { ChatView } from "@/components/ChatView";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function ChatLandingPage() {
  if (!getConfig().features.chat) notFound();
  const chats = await listChats();
  if (chats.length > 0) {
    redirect(`/chat/${chats[0].id}`);
  }
  const chat = await createChat();
  return <ChatView initial={chat} />;
}
