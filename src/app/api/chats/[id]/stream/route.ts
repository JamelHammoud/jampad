import { NextRequest } from "next/server";
import { readChat, writeChat } from "@/lib/chats";
import { runClaude } from "@/lib/claude";
import type { ChatMessage } from "@/lib/types";
import { ChatStreamAccumulator } from "@/lib/chat-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  message: string;
  mode: "plan" | "apply";
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.message !== "string") {
    return new Response("Invalid body", { status: 400 });
  }

  const chat = await readChat(id);
  if (!chat) return new Response("Not found", { status: 404 });

  const now = new Date().toISOString();
  const userMsg: ChatMessage = {
    role: "user",
    content: body.message,
    createdAt: now,
  };
  chat.messages.push(userMsg);

  if (chat.title === "New chat" || !chat.title) {
    chat.title = body.message.slice(0, 60).replace(/\s+/g, " ").trim();
  }
  chat.updatedAt = now;
  await writeChat(chat);

  const encoder = new TextEncoder();
  const acc = new ChatStreamAccumulator(body.mode);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        await runClaude({
          prompt: body.message,
          resumeSessionId: chat.sessionId,
          mode: body.mode,
          signal: req.signal,
          onEvent: (ev) => {
            acc.onEvent(ev);
            send(ev);
          },
        });
      } catch (err) {
        send({
          kind: "error",
          message: err instanceof Error ? err.message : "Claude failed",
        });
      } finally {
        const runLog = acc.finalize();
        const final = await readChat(id);
        if (final) {
          final.sessionId = acc.sessionId ?? final.sessionId;
          final.messages = chat.messages.concat(runLog);
          final.updatedAt = new Date().toISOString();
          await writeChat(final);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
