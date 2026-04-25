import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { ChatView } from "@/client/components/ChatView";
import type { ChatData } from "@/shared/types";

type State =
  | { kind: "loading" }
  | { kind: "ok"; chat: ChatData }
  | { kind: "missing" };

export function ChatRoute() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setState({ kind: "loading" });
    fetch(`/api/chats/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setState({ kind: "missing" });
          return;
        }
        if (!res.ok) throw new Error(`status ${res.status}`);
        const chat = (await res.json()) as ChatData;
        setState({ kind: "ok", chat });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === "loading") return null;
  if (state.kind === "missing") return <Navigate to="/" replace />;
  return <ChatView initial={state.chat} />;
}
