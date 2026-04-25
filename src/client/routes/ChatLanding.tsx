import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ChatView } from "@/client/components/ChatView";
import type { ChatData } from "@/shared/types";

type State =
  | { kind: "loading" }
  | { kind: "redirect"; id: string }
  | { kind: "fresh"; chat: ChatData };

export function ChatLandingRoute() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetch("/api/chats").then((r) => r.json());
      if (cancelled) return;
      const chats = (list.chats ?? []) as { id: string }[];
      if (chats.length > 0) {
        setState({ kind: "redirect", id: chats[0].id });
        return;
      }
      const chat = (await fetch("/api/chats", { method: "POST" }).then((r) =>
        r.json(),
      )) as ChatData;
      if (!cancelled) setState({ kind: "fresh", chat });
    })().catch(() => {
      /* surfaced via empty render */
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") return null;
  if (state.kind === "redirect")
    return <Navigate to={`/chat/${state.id}`} replace />;
  return <ChatView initial={state.chat} />;
}
