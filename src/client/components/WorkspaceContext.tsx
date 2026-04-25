import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChatMeta, SectionGroup } from "@/shared/types";
import { useClientConfig } from "./ConfigContext";

type WorkspaceContextValue = {
  sections: SectionGroup[];
  chats: ChatMeta[];
  loading: boolean;
  refresh: () => Promise<void>;
  refreshChats: () => Promise<void>;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const cfg = useClientConfig();
  const chatEnabled = cfg.features.chat;
  const [sections, setSections] = useState<SectionGroup[]>([]);
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const refreshChats = useCallback(async () => {
    if (!chatEnabled) return;
    try {
      const res = await fetch("/api/chats", { cache: "no-store" });
      const data = await res.json();
      setChats(data.chats ?? []);
    } catch {
      /* ignore */
    }
  }, [chatEnabled]);

  const refresh = useCallback(async () => {
    try {
      const [tree] = await Promise.all([
        fetch("/api/tree", { cache: "no-store" }).then((r) => r.json()),
        refreshChats(),
      ]);
      setSections(tree.sections ?? []);
    } finally {
      setLoading(false);
    }
  }, [refreshChats]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (
        mod &&
        (e.key === "k" || e.key === "K" || e.key === "p" || e.key === "P")
      ) {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(
    () => ({
      sections,
      chats,
      loading,
      refresh,
      refreshChats,
      paletteOpen,
      setPaletteOpen,
    }),
    [sections, chats, loading, refresh, refreshChats, paletteOpen],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
