import { Hono } from "hono";
import {
  createChat,
  deleteChat,
  listChats,
  readChat,
  writeChat,
} from "@/server/lib/chats";
import { runClaude } from "@/server/lib/claude";
import { getConfig } from "@/server/lib/config";
import { ChatStreamAccumulator } from "@/shared/chat-stream";
import type { ChatMessage } from "@/shared/types";

export const chatsRoute = new Hono();

function chatGuardResponse(): Response | null {
  if (!getConfig().features.chat) {
    return new Response(JSON.stringify({ error: "Chat disabled" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

chatsRoute.use("*", async (c, next) => {
  const blocked = chatGuardResponse();
  if (blocked) return blocked;
  await next();
});

chatsRoute.get("/", async (c) => {
  const chats = await listChats();
  return c.json({ chats });
});

chatsRoute.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { title?: string };
  const chat = await createChat(
    typeof body.title === "string" ? body.title : undefined,
  );
  return c.json(chat);
});

chatsRoute.get("/:id", async (c) => {
  const chat = await readChat(c.req.param("id"));
  if (!chat) return c.json({ error: "Not found" }, 404);
  return c.json(chat);
});

chatsRoute.delete("/:id", async (c) => {
  await deleteChat(c.req.param("id"));
  return c.json({ ok: true });
});

chatsRoute.put("/:id/title", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { title?: string };
  const chat = await readChat(id);
  if (!chat) return c.json({ error: "Not found" }, 404);
  chat.title = (body.title ?? "").trim() || chat.title;
  chat.updatedAt = new Date().toISOString();
  await writeChat(chat);
  return c.json({ ok: true });
});

chatsRoute.post("/:id/stream", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as {
    message: string;
    mode: "plan" | "apply";
  } | null;
  if (!body || typeof body.message !== "string") {
    return c.text("Invalid body", 400);
  }

  const chat = await readChat(id);
  if (!chat) return c.text("Not found", 404);

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
          signal: c.req.raw.signal,
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
});
