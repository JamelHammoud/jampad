import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { randomUUID } from "node:crypto";
import { chatsRoot } from "./paths";
import type { ChatData, ChatMessage, ChatMeta } from "./types";

async function ensureRoot() {
  await fs.mkdir(chatsRoot(), { recursive: true });
}

function chatPath(id: string) {
  return path.join(chatsRoot(), `${id}.md`);
}

export function serializeMessages(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      let header: string;
      if (m.role === "user") header = "## You";
      else if (m.role === "assistant") {
        if (m.mode === "apply") header = "## Claude (applied)";
        else if (m.hasPlan) header = "## Claude (plan)";
        else header = "## Claude";
      } else if (m.role === "thinking")
        header = m.thinkingMs
          ? `## Thinking (${m.thinkingMs}ms)`
          : "## Thinking";
      else header = `## Tool ${m.toolName ?? ""}`.trim();
      const inputBlock =
        m.role === "tool" && m.toolInput
          ? `\n\n<!-- input\n${m.toolInput}\n-->`
          : "";
      return `${header}\n<!-- ${m.createdAt} -->\n\n${m.content.trim()}${inputBlock}`;
    })
    .join("\n\n");
}

const ROLE_HEADER_RE =
  /^## (You|Claude(?:\s\([^)]+\))?|Thinking(?:\s\([^)]+\))?|Tool(?:\s.+)?)\s*$/;

export function parseMessages(body: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const lines = body.split("\n");
  let currentHeader: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentHeader) return;
    const raw = currentHeader.replace(/^## /, "");
    const rl = raw.toLowerCase();
    let role: ChatMessage["role"];
    let toolName: string | undefined;
    if (rl.startsWith("you")) role = "user";
    else if (rl.startsWith("claude")) role = "assistant";
    else if (rl.startsWith("thinking")) role = "thinking";
    else if (rl.startsWith("tool")) {
      role = "tool";
      const rest = raw.slice(4).trim();
      toolName = rest || undefined;
    } else {
      currentHeader = null;
      currentLines = [];
      return;
    }

    const mode = /applied/i.test(raw) ? "apply" : undefined;
    const hasPlan = /\(plan\)/i.test(raw);
    const thinkingMsMatch = raw.match(/\((\d+)ms\)/i);
    const thinkingMs = thinkingMsMatch
      ? parseInt(thinkingMsMatch[1], 10)
      : undefined;
    let content = currentLines.join("\n").trim();
    const tsMatch = content.match(/^<!--\s*(.+?)\s*-->/);
    const createdAt = tsMatch ? tsMatch[1] : new Date().toISOString();
    content = tsMatch ? content.slice(tsMatch[0].length).trim() : content;
    const inputMatch = content.match(/<!--\s*input\s*([\s\S]*?)\s*-->\s*$/);
    const toolInput = inputMatch ? inputMatch[1].trim() : undefined;
    const inner = inputMatch
      ? content.slice(0, inputMatch.index).trim()
      : content;
    currentHeader = null;
    currentLines = [];
    if (!inner && role !== "tool" && role !== "thinking") return;
    messages.push({
      role,
      content: inner,
      mode,
      hasPlan: role === "assistant" && hasPlan ? true : undefined,
      toolName,
      toolInput,
      thinkingMs: role === "thinking" ? thinkingMs : undefined,
      createdAt,
    });
  };

  for (const line of lines) {
    if (ROLE_HEADER_RE.test(line)) {
      flush();
      currentHeader = line;
    } else if (currentHeader) {
      currentLines.push(line);
    }
  }
  flush();
  return messages;
}

export async function listChats(): Promise<ChatMeta[]> {
  await ensureRoot();
  const entries = await fs.readdir(chatsRoot(), { withFileTypes: true });
  const chats: ChatMeta[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const abs = path.join(chatsRoot(), entry.name);
    const raw = await fs.readFile(abs, "utf8").catch(() => "");
    const parsed = matter(raw);
    chats.push({
      id: String(parsed.data.id ?? entry.name.replace(/\.md$/, "")),
      title: String(parsed.data.title ?? "Untitled chat"),
      sessionId:
        typeof parsed.data.sessionId === "string"
          ? parsed.data.sessionId
          : undefined,
      createdAt: String(parsed.data.createdAt ?? new Date().toISOString()),
      updatedAt: String(parsed.data.updatedAt ?? new Date().toISOString()),
    });
  }
  return chats.sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );
}

export async function readChat(id: string): Promise<ChatData | null> {
  await ensureRoot();
  const abs = chatPath(id);
  try {
    const raw = await fs.readFile(abs, "utf8");
    const parsed = matter(raw);
    return {
      id,
      title: String(parsed.data.title ?? "Untitled chat"),
      sessionId:
        typeof parsed.data.sessionId === "string"
          ? parsed.data.sessionId
          : undefined,
      createdAt: String(parsed.data.createdAt ?? new Date().toISOString()),
      updatedAt: String(parsed.data.updatedAt ?? new Date().toISOString()),
      messages: parseMessages(parsed.content),
    };
  } catch {
    return null;
  }
}

export async function writeChat(chat: ChatData): Promise<void> {
  await ensureRoot();
  const abs = chatPath(chat.id);
  const front = {
    id: chat.id,
    title: chat.title,
    sessionId: chat.sessionId ?? "",
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
  const body = serializeMessages(chat.messages);
  await fs.writeFile(abs, matter.stringify(body, front), "utf8");
}

export async function createChat(title?: string): Promise<ChatData> {
  const now = new Date().toISOString();
  const chat: ChatData = {
    id: randomUUID(),
    title: title?.trim() || "New chat",
    sessionId: undefined,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  await writeChat(chat);
  return chat;
}

export async function deleteChat(id: string): Promise<void> {
  await fs.rm(chatPath(id), { force: true });
}
