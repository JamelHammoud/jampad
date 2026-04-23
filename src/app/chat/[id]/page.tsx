import { notFound } from "next/navigation";
import { readChat } from "@/lib/chats";
import { ChatView } from "@/components/ChatView";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ChatPage({ params }: Props) {
  if (!getConfig().features.chat) notFound();
  const { id } = await params;
  const chat = await readChat(id);
  if (!chat) notFound();
  return <ChatView initial={chat} />;
}
