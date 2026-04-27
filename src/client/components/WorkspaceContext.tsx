import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChatMeta, DrawingMeta, SectionGroup } from "@/shared/types";
import { useClientConfig } from "./ConfigContext";

type WorkspaceContextValue = {
  sections: SectionGroup[];
  chats: ChatMeta[];
  drawings: DrawingMeta[];
  loading: boolean;
  refresh: () => Promise<void>;
  refreshChats: () => Promise<void>;
  refreshDrawings: () => Promise<void>;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const cfg = useClientConfig();
  const chatEnabled = cfg.features.chat;
  const drawEnabled = cfg.features.draw;
  const [sections, setSections] = useState<SectionGroup[]>([]);
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [drawings, setDrawings] = useState<DrawingMeta[]>([]);
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

  const refreshDrawings = useCallback(async () => {
    if (!drawEnabled) return;
    try {
      const res = await fetch("/api/drawings", { cache: "no-store" });
      const data = await res.json();
      setDrawings(data.drawings ?? []);
    } catch {
      /* ignore */
    }
  }, [drawEnabled]);

  const refresh = useCallback(async () => {
    try {
      const [tree] = await Promise.all([
        fetch("/api/tree", { cache: "no-store" }).then((r) => r.json()),
        refreshChats(),
        refreshDrawings(),
      ]);
      setSections(tree.sections ?? []);
    } finally {
      setLoading(false);
    }
  }, [refreshChats, refreshDrawings]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to /api/events so the sidebar reflects changes made outside
  // jampad (a markdown file dropped in by another editor, a `mv`, etc).
  // EventSource handles automatic reconnection on transient failures.
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("tree-changed", () => {
      refresh();
    });
    return () => es.close();
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
      drawings,
      loading,
      refresh,
      refreshChats,
      refreshDrawings,
      paletteOpen,
      setPaletteOpen,
    }),
    [
      sections,
      chats,
      drawings,
      loading,
      refresh,
      refreshChats,
      refreshDrawings,
      paletteOpen,
    ],
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
