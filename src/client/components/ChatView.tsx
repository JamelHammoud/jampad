import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Bot,
  CheckCheck,
  ChevronRight,
  FileText,
  Globe,
  Layers,
  Loader2,
  Search,
  Settings2,
  Square,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import type {
  ChatData,
  ChatMessage,
  ChatMode,
  ClaudeStreamEvent,
} from "@/shared/types";
import { PLAN_TOOLS } from "@/shared/types";
import { useClientConfig } from "./ConfigContext";
import { useWorkspace } from "./WorkspaceContext";
import { summarizeTool } from "@/shared/toolLabel";
import { scrubLlmProse } from "@/shared/prose";

type Props = { initial: ChatData };

export function ChatView({ initial }: Props) {
  const { refresh, refreshChats } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages);
  const [liveSteps, setLiveSteps] = useState<ChatMessage[]>([]);
  const [title, setTitle] = useState(initial.title);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("plan");
  const [sending, setSending] = useState(false);
  const [queued, setQueued] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, liveSteps]);

  const sendMessage = useCallback(
    async (text: string, sendMode: ChatMode) => {
      if (!text.trim() || sending) return;
      setInput("");
      setSending(true);
      setLiveSteps([]);

      const now = new Date().toISOString();
      const userMsg: ChatMessage = {
        role: "user",
        content: text,
        createdAt: now,
      };
      setMessages((m) => [...m, userMsg]);

      if (messages.length === 0 && title === "New chat") {
        const next = text.slice(0, 60).replace(/\s+/g, " ").trim();
        setTitle(next);
        fetch(`/api/chats/${initial.id}/title`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: next }),
        }).catch(() => {});
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const localSteps: ChatMessage[] = [];
      let sawPlanTool = false;
      const bump = () => setLiveSteps([...localSteps]);
      const lastOfKind = (kind: "assistant" | "thinking") => {
        for (let i = localSteps.length - 1; i >= 0; i--) {
          const s = localSteps[i];
          if (s.role === kind) return s;
          if (s.role !== kind) break;
        }
        return null;
      };

      try {
        const res = await fetch(`/api/chats/${initial.id}/stream`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text, mode: sendMode }),
          signal: ctrl.signal,
        });
        if (!res.body) throw new Error("No response body");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = chunk.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            let ev: ClaudeStreamEvent;
            try {
              ev = JSON.parse(line.slice(6)) as ClaudeStreamEvent;
            } catch {
              continue;
            }

            if (ev.kind === "text") {
              const last = lastOfKind("assistant");
              if (last) {
                last.content += ev.text;
              } else {
                localSteps.push({
                  role: "assistant",
                  content: ev.text,
                  mode: sendMode,
                  createdAt: new Date().toISOString(),
                });
              }
              bump();
            } else if (ev.kind === "thinking") {
              const last = lastOfKind("thinking");
              if (last) {
                last.content += ev.text;
              } else {
                localSteps.push({
                  role: "thinking",
                  content: ev.text,
                  createdAt: new Date().toISOString(),
                });
              }
              bump();
            } else if (ev.kind === "thinking_done") {
              const last = lastOfKind("thinking");
              if (last) {
                last.thinkingMs = ev.durationMs;
                bump();
              }
            } else if (ev.kind === "tool_use") {
              if (PLAN_TOOLS.has(ev.name.toLowerCase())) sawPlanTool = true;
              localSteps.push({
                role: "tool",
                content: summarizeTool(ev.name, ev.input),
                toolName: ev.name,
                toolInput: JSON.stringify(ev.input ?? {}),
                createdAt: new Date().toISOString(),
              });
              bump();
            } else if (ev.kind === "error") {
              localSteps.push({
                role: "assistant",
                content: `⚠️ ${ev.message}`,
                mode: sendMode,
                createdAt: new Date().toISOString(),
              });
              bump();
            }
          }
        }

        const committed = localSteps.length
          ? localSteps
          : [
              {
                role: "assistant" as const,
                content: "(no response)",
                mode: sendMode,
                createdAt: new Date().toISOString(),
              },
            ];
        for (const s of committed) {
          if (s.role === "assistant" && sawPlanTool && sendMode === "plan") {
            s.hasPlan = true;
          }
        }
        setMessages((m) => [...m, ...committed]);
        setLiveSteps([]);
        await Promise.all([refreshChats(), refresh()]);
      } catch (err) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `⚠️ ${err instanceof Error ? err.message : "request failed"}`,
            mode: sendMode,
            createdAt: new Date().toISOString(),
          },
        ]);
        setLiveSteps([]);
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    [initial.id, messages.length, refresh, refreshChats, sending, title],
  );

  const handleSend = useCallback(
    (text: string, steer: boolean) => {
      if (!text.trim()) return;
      if (!sending) {
        sendMessage(text, mode);
        return;
      }
      setQueued(text);
      setInput("");
      if (steer && abortRef.current) {
        abortRef.current.abort();
      }
    },
    [mode, sendMessage, sending],
  );

  const cancelQueued = useCallback(() => setQueued(null), []);

  const stopNow = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  useEffect(() => {
    if (!sending && queued) {
      const next = queued;
      setQueued(null);
      sendMessage(next, mode);
    }
  }, [sending, queued, mode, sendMessage]);

  const allSteps = sending ? [...messages, ...liveSteps] : messages;
  const isEmpty = allSteps.length === 0;

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-1 min-h-0">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 right-0 h-10 z-10 bg-gradient-to-b from-white to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 z-10 bg-gradient-to-t from-white to-transparent"
        />
        <div ref={scrollRef} className="h-full overflow-y-auto">
          {isEmpty ? (
            <EmptyState />
          ) : (
            <div className="mx-auto max-w-[760px] px-6 py-8 flex flex-col gap-3">
              {allSteps.map((m, i) => (
                <Row
                  key={`${m.createdAt}-${i}`}
                  message={m}
                  onApply={
                    m.role === "assistant" &&
                    m.mode === "plan" &&
                    m.hasPlan &&
                    i === allSteps.length - 1
                      ? () =>
                          sendMessage(
                            `Apply the plan above. Make the edits now.`,
                            "apply",
                          )
                      : undefined
                  }
                />
              ))}
              {sending && <ThinkingIndicator />}
            </div>
          )}
        </div>
      </div>

      <Composer
        value={input}
        onChange={setInput}
        mode={mode}
        onModeChange={setMode}
        onSend={(steer) => handleSend(input, steer)}
        onStop={stopNow}
        sending={sending}
        queued={queued}
        onCancelQueued={cancelQueued}
      />
    </div>
  );
}

function EmptyState() {
  const cfg = useClientConfig();
  return (
    <div className="mx-auto max-w-[720px] px-6 pt-[22vh] text-center">
      <h1 className="text-[32px] font-bold leading-tight tracking-tight">
        {cfg.strings.chatEmpty}
      </h1>
    </div>
  );
}

function Row({
  message,
  onApply,
}: {
  message: ChatMessage;
  onApply?: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end mt-4 first:mt-0">
        <div className="max-w-[86%] rounded-2xl bg-[color:var(--bg-hover-strong)] p-[22px] text-[15px] leading-[18px] whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }
  if (message.role === "tool") {
    return <ToolStep message={message} />;
  }
  if (message.role === "thinking") {
    return (
      <ThinkingStep text={message.content} durationMs={message.thinkingMs} />
    );
  }
  return (
    <div className="flex gap-3 mt-2">
      <AssistantAvatar />
      <div className="flex-1 min-w-0 pt-1">
        <div className="prose-chat">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {scrubLlmProse(message.content)}
          </ReactMarkdown>
        </div>
        {onApply && (
          <div className="mt-3 flex gap-2">
            <button
              className="inline-flex items-center gap-2 bg-[color:var(--fg)] text-white text-[13px] font-medium rounded-md px-3 py-1.5 hover:opacity-90"
              onClick={onApply}
            >
              <CheckCheck size={14} strokeWidth={2.5} />
              Apply changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatToolInput(raw?: string): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

function ToolStep({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false);
  const name = message.toolName ?? "Tool";
  const summary = message.content;
  return (
    <div className="pl-10">
      <button
        className="group flex items-center gap-2 text-[13px] text-left w-full hover:bg-[color:var(--bg-hover)] rounded-md px-1.5 py-1 -ml-1.5 transition"
        onClick={() => setOpen((s) => !s)}
      >
        <ChevronRight
          size={12}
          className="text-[color:var(--fg-40)] shrink-0"
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0)",
            transition: "transform 120ms ease",
          }}
        />
        <span className="inline-flex items-center justify-center w-4 h-4 text-[color:var(--fg-60)] shrink-0">
          <ToolIcon name={name} />
        </span>
        <span className="font-medium text-[color:var(--fg-60)] shrink-0">
          {name}
        </span>
        <span className="truncate text-[color:var(--fg-50)] font-mono text-[12.5px]">
          {summary}
        </span>
      </button>
      {open && (
        <div className="mt-1.5 ml-[26px] mr-2 rounded-2xl bg-[color:var(--bg-hover)] p-4 text-[12.5px] text-[color:var(--fg-70)] font-mono whitespace-pre-wrap break-all">
          {formatToolInput(message.toolInput) ?? summary}
        </div>
      )}
    </div>
  );
}

function ToolIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n === "read" || n === "notebookread") return <FileText size={14} />;
  if (n === "write" || n === "edit" || n === "multiedit")
    return <FileText size={14} />;
  if (n === "grep" || n === "glob") return <Search size={14} />;
  if (n === "bash") return <Terminal size={14} />;
  if (n === "webfetch" || n === "websearch") return <Globe size={14} />;
  if (n === "agent" || n === "task") return <Bot size={14} />;
  return <Wrench size={14} />;
}

function AssistantAvatar() {
  const cfg = useClientConfig();
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-white shadow-[0_0_0_1px_rgba(15,15,15,0.08)]">
      {cfg.branding.logoImage ? (
        <img
          src={cfg.branding.logoImage}
          alt={cfg.branding.name}
          className="w-[16px] h-[16px] rounded"
        />
      ) : (
        <span className="text-[14px] leading-none">{cfg.branding.logo}</span>
      )}
    </div>
  );
}

function formatThinkingDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (rem === 0) return `${m} minute${m === 1 ? "" : "s"}`;
  return `${m}m ${rem}s`;
}

function ThinkingStep({
  text,
  durationMs,
}: {
  text: string;
  durationMs?: number;
}) {
  const [open, setOpen] = useState(false);
  const hasText = !!text.trim();
  const done = durationMs !== undefined;
  const firstLine = hasText
    ? (text
        .split("\n")
        .find((l) => l.trim())
        ?.trim() ?? "Thought")
    : done
      ? `Thought for ${formatThinkingDuration(durationMs!)}`
      : "Thinking...";
  const preview =
    firstLine.length > 140 ? firstLine.slice(0, 137) + "…" : firstLine;
  const interactive = hasText;

  return (
    <div className="pl-10">
      <button
        onClick={() => interactive && setOpen((s) => !s)}
        className={`flex items-center gap-2 text-[13px] text-[color:var(--fg-60)] rounded-md px-2 py-1 -ml-2 transition w-full text-left ${
          interactive ? "hover:bg-[color:var(--bg-hover)]" : "cursor-default"
        }`}
      >
        {interactive && (
          <ChevronRight
            size={12}
            className="text-[color:var(--fg-40)] shrink-0"
            style={{
              transform: open ? "rotate(90deg)" : "rotate(0)",
              transition: "transform 120ms ease",
            }}
          />
        )}
        <span className={`truncate flex-1 ${!done ? "thinking-shimmer" : ""}`}>
          {preview}
        </span>
      </button>
      {open && hasText && (
        <div className="mt-1.5 ml-3 pl-4 border-l-2 border-[color:var(--fg-09)] text-[13px] leading-[1.65] text-[color:var(--fg-60)] whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-3 mt-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-white shadow-[0_0_0_1px_rgba(15,15,15,0.08)]">
        <Loader2 size={14} className="animate-spin text-[color:var(--fg-60)]" />
      </div>
    </div>
  );
}

function Composer({
  value,
  onChange,
  mode,
  onModeChange,
  onSend,
  onStop,
  sending,
  queued,
  onCancelQueued,
}: {
  value: string;
  onChange: (v: string) => void;
  mode: ChatMode;
  onModeChange: (m: ChatMode) => void;
  onSend: (steer: boolean) => void;
  onStop: () => void;
  sending: boolean;
  queued: string | null;
  onCancelQueued: () => void;
}) {
  const cfg = useClientConfig();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(220, el.scrollHeight) + "px";
  }, [value]);

  const canSubmit = !!value.trim();

  return (
    <div className="px-6 pb-10 pt-2">
      <div className="mx-auto max-w-[760px]">
        {queued && (
          <div className="mb-2 flex items-center gap-2 rounded-full bg-[color:var(--bg-hover)] px-3 py-1.5 text-[13px] text-[color:var(--fg-70)] w-fit">
            <Layers size={13} />
            <span className="truncate max-w-[520px]">Queued: {queued}</span>
            <button
              onClick={onCancelQueued}
              className="text-[color:var(--fg-50)] hover:text-[color:var(--fg)] ml-1"
              aria-label="Cancel queued"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="rounded-[28px] border border-[color:var(--divider)] bg-white shadow-[0_1px_3px_rgba(15,15,15,0.04)] focus-within:shadow-[0_2px_12px_rgba(15,15,15,0.1)] transition">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              sending
                ? "Steer or queue a follow-up…"
                : cfg.strings.chatPlaceholder
            }
            className="w-full resize-none px-5 pt-5 pb-3 text-[15px] leading-[1.45] bg-transparent outline-none"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const queue = (e.metaKey || e.ctrlKey) && sending;
                onSend(queue ? false : sending);
              }
            }}
          />
          <div className="flex items-center gap-2 px-3 pb-3">
            <ModeToggle mode={mode} onChange={onModeChange} />
            <div className="flex-1" />
            {sending && canSubmit && (
              <button
                onClick={() => onSend(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-[color:var(--bg-hover-strong)] text-[color:var(--fg)] hover:bg-[color:var(--bg-active)]"
                aria-label="Queue after current response (⏎)"
                title="Queue after current response (⏎)"
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            )}
            {sending && !canSubmit ? (
              <button
                onClick={onStop}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-[color:var(--fg)] text-white hover:opacity-90"
                aria-label="Stop"
                title="Stop"
              >
                <Square size={12} strokeWidth={0} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={() => onSend(sending)}
                disabled={!canSubmit}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-[color:var(--fg)] text-white hover:opacity-90 disabled:bg-[color:var(--bg-hover-strong)] disabled:text-[color:var(--fg-40)]"
                aria-label={sending ? "Send now (⌘⏎)" : "Send (⏎)"}
                title={sending ? "Send now, don't wait (⌘⏎)" : "Send (⏎)"}
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: ChatMode;
  onChange: (m: ChatMode) => void;
}) {
  return (
    <div className="inline-flex items-center text-[13px] text-[color:var(--fg-60)] rounded-full bg-[color:var(--bg-hover)] p-[3px]">
      <button
        className={`px-3 py-1 rounded-full flex items-center gap-1.5 ${
          mode === "plan"
            ? "bg-white text-[color:var(--fg)] shadow-[0_0_0_1px_rgba(15,15,15,0.05)]"
            : ""
        }`}
        onClick={() => onChange("plan")}
      >
        <Settings2 size={13} strokeWidth={2.5} />
        Ideate
      </button>
      <button
        className={`px-3 py-1 rounded-full flex items-center gap-1.5 ${
          mode === "apply"
            ? "bg-white text-[color:var(--fg)] shadow-[0_0_0_1px_rgba(15,15,15,0.05)]"
            : ""
        }`}
        onClick={() => onChange("apply")}
      >
        <CheckCheck size={13} strokeWidth={2.5} />
        Write
      </button>
    </div>
  );
}
