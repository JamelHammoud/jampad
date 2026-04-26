import { Link } from "@/client/lib/router";
import { usePathname, useRouter } from "@/client/lib/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  FileText,
  Home,
  MessageCircle,
  MessageSquarePlus,
  MessagesSquare,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import type { TreeNode } from "@/shared/types";
import { slugEqual, slugStartsWith, slugToHref } from "@/shared/slug";
import { useWorkspace } from "./WorkspaceContext";
import { useClientConfig } from "./ConfigContext";

function currentSlugFromPath(pathname: string): string[] {
  if (!pathname || pathname === "/") return [];
  return pathname
    .split("/")
    .filter(Boolean)
    .map((p) => decodeURIComponent(p));
}

export function Sidebar() {
  const { sections, chats, refresh, refreshChats, setPaletteOpen } =
    useWorkspace();
  const cfg = useClientConfig();
  const pathname = usePathname();
  const current = currentSlugFromPath(pathname);
  const router = useRouter();
  const chatEnabled = cfg.features.chat;
  const viewMode: "home" | "chat" =
    chatEnabled && pathname.startsWith("/chat") ? "chat" : "home";
  const isHome = viewMode === "home" && current.length === 0;
  const activeChatId = pathname.startsWith("/chat/")
    ? decodeURIComponent(pathname.slice("/chat/".length))
    : null;

  const autoExpanded = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < current.length; i++) {
      set.add(current.slice(0, i + 1).join("/"));
    }
    return set;
  }, [current]);

  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const isExpanded = useCallback(
    (slug: string[]) => {
      const key = slug.join("/");
      if (collapsed.has(key)) return false;
      if (autoExpanded.has(key)) return true;
      return manualExpanded.has(key);
    },
    [autoExpanded, collapsed, manualExpanded],
  );

  const toggleExpanded = useCallback(
    (slug: string[]) => {
      const key = slug.join("/");
      const auto = autoExpanded.has(key);
      const setter = auto ? setCollapsed : setManualExpanded;
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [autoExpanded],
  );

  const addPage = useCallback(
    async (parentSlug: string[]) => {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parentSlug,
          title: "Untitled",
          kind: "page",
        }),
      });
      if (!res.ok) return;
      const { slug } = (await res.json()) as { slug: string[] };
      await refresh();
      router.push(slugToHref(slug));
    },
    [refresh, router],
  );

  const newChat = useCallback(async () => {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { id: string };
    await refreshChats();
    router.push(`/chat/${data.id}`);
  }, [refreshChats, router]);

  useEffect(() => {
    if (!chatEnabled) return;
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        newChat();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatEnabled, newChat]);

  const deleteChat = useCallback(
    async (id: string) => {
      const ok = window.confirm("Delete this chat?");
      if (!ok) return;
      await fetch(`/api/chats/${id}`, { method: "DELETE" });
      await refreshChats();
      if (activeChatId === id) router.push("/");
    },
    [activeChatId, refreshChats, router],
  );

  const addSection = useCallback(async () => {
    const name = window.prompt("Section name");
    if (!name || !name.trim()) return;
    await fetch("/api/pages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        parentSlug: [],
        title: name.trim(),
        kind: "folder",
      }),
    });
    await refresh();
  }, [refresh]);

  const deleteNode = useCallback(
    async (slug: string[]) => {
      const ok = window.confirm("Delete this page?");
      if (!ok) return;
      await fetch("/api/pages/" + slug.map(encodeURIComponent).join("/"), {
        method: "DELETE",
      });
      await refresh();
      if (slugStartsWith(current, slug)) router.push("/");
    },
    [current, refresh, router],
  );

  return (
    <aside
      className="h-full w-[260px] shrink-0 border-r border-[color:var(--fg-05)] flex flex-col"
      style={{ background: "var(--bg-sidebar)" }}
    >
      <WorkspaceHeader />

      <div className="sidebar-nav-row">
        {viewMode === "home" ? (
          <>
            <Link
              href="/"
              className="nav-btn primary"
              data-active={isHome || undefined}
            >
              <Home size={16} />
              <span>Home</span>
            </Link>
            {chatEnabled && (
              <Link
                href="/chat"
                className="nav-btn"
                title="Chat"
                aria-label="Chat"
              >
                <MessageCircle size={16} />
              </Link>
            )}
          </>
        ) : (
          <>
            <Link href="/" className="nav-btn" title="Home" aria-label="Home">
              <Home size={16} />
            </Link>
            {chatEnabled && (
              <Link href="/chat" className="nav-btn primary" data-active>
                <MessageCircle size={16} />
                <span>Chat</span>
              </Link>
            )}
          </>
        )}
        {cfg.features.search && (
          <button
            className="nav-btn"
            title={`${cfg.strings.searchPlaceholder} (⌘K)`}
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
          >
            <Search size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto pb-4">
        {viewMode === "chat" ? (
          <ChatSidebar
            chats={chats}
            activeChatId={activeChatId}
            onOpen={(id) => router.push(`/chat/${id}`)}
            onDelete={deleteChat}
          />
        ) : sections.length === 0 ? (
          <EmptyState onAddSection={addSection} />
        ) : (
          sections.map((section) => (
            <div key={section.key} className="sidebar-section-group">
              <div className="sidebar-section-label">
                <span className="flex-1">{section.label}</span>
                <button
                  className="add-btn"
                  onClick={() => addPage(section.slug)}
                  aria-label={`Add a page in ${section.label}`}
                  title="Add a page"
                >
                  <Plus size={14} strokeWidth={2.75} />
                </button>
              </div>
              <div>
                {section.tree.map((node) => (
                  <TreeRow
                    key={node.slug.join("/")}
                    node={node}
                    depth={0}
                    current={current}
                    isExpanded={isExpanded}
                    toggleExpanded={toggleExpanded}
                    onAddPage={addPage}
                    onDelete={deleteNode}
                  />
                ))}
                <AddRow
                  depth={0}
                  label="Add new"
                  onClick={() => addPage(section.slug)}
                />
              </div>
            </div>
          ))
        )}

        {viewMode === "home" && (
          <>
            <div className="pt-4" />
            <AddRow depth={0} label="New section" onClick={addSection} />
          </>
        )}
      </nav>

      {chatEnabled && (
        <div className="sidebar-bottom">
          <button className="new-chat-pill" onClick={newChat}>
            <MessageSquarePlus size={16} />
            <span>{cfg.strings.newChat}</span>
            <span className="shortcut">⌘O</span>
          </button>
        </div>
      )}
    </aside>
  );
}

function AddRow({
  depth,
  label,
  onClick,
}: {
  depth: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <div
      className="sidebar-row muted"
      style={{ paddingLeft: depth * 14 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className="toggle" aria-hidden>
        <span style={{ width: 12 }} />
      </span>
      <span className="icon" aria-hidden>
        <Plus size={14} strokeWidth={2.75} />
      </span>
      <span className="label">{label}</span>
    </div>
  );
}

function WorkspaceHeader() {
  const cfg = useClientConfig();
  if (!cfg.branding.showLogo && !cfg.branding.name) return null;
  const label = cfg.branding.name;
  return (
    <div className="flex items-center gap-2 h-[44px] pl-[14px] pr-3 shrink-0">
      {cfg.branding.showLogo && cfg.branding.logoImage ? (
        <img
          src={cfg.branding.logoImage}
          alt={label}
          className="w-[22px] h-[22px] rounded"
        />
      ) : cfg.branding.showLogo ? (
        <span className="text-[20px] leading-none">{cfg.branding.logo}</span>
      ) : null}
      {label && (
        <span className="text-[14px] font-medium text-[color:var(--fg)] truncate">
          {label}
        </span>
      )}
    </div>
  );
}

function ChatSidebar({
  chats,
  activeChatId,
  onOpen,
  onDelete,
}: {
  chats: { id: string; title: string; updatedAt: string }[];
  activeChatId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      {chats.length === 0 ? (
        <div className="chat-empty">
          <MessagesSquare size={22} strokeWidth={1.6} />
          <div className="chat-empty-text">No chats yet</div>
        </div>
      ) : (
        <div className="sidebar-section-group">
          <div className="sidebar-section-label">
            <span className="flex-1">Recents</span>
          </div>
          <div>
            {chats.map((chat) => (
              <div
                key={chat.id}
                className="sidebar-row"
                data-active={activeChatId === chat.id || undefined}
                style={{ paddingLeft: 0 }}
                onClick={() => onOpen(chat.id)}
                role="button"
                tabIndex={0}
              >
                <span className="toggle" aria-hidden>
                  <span style={{ width: 12 }} />
                </span>
                <span className="icon" aria-hidden>
                  <MessagesSquare size={14} />
                </span>
                <span className="label">{chat.title || "Untitled"}</span>
                <span className="actions">
                  <button
                    title="Delete chat"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(chat.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function EmptyState({ onAddSection }: { onAddSection: () => void }) {
  return (
    <div className="px-4 pt-6 text-center">
      <div className="text-[13px] text-[color:var(--fg-60)] mb-3 leading-snug">
        Create a section to start organizing your pages.
      </div>
      <button
        className="px-3 py-1.5 rounded-md border border-[color:var(--divider)] bg-white text-[13px] text-[color:var(--fg)] hover:bg-[color:var(--bg-hover)]"
        onClick={onAddSection}
      >
        + New section
      </button>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  current,
  isExpanded,
  toggleExpanded,
  onAddPage,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  current: string[];
  isExpanded: (slug: string[]) => boolean;
  toggleExpanded: (slug: string[]) => void;
  onAddPage: (slug: string[]) => void | Promise<void>;
  onDelete: (slug: string[]) => void | Promise<void>;
}) {
  const router = useRouter();
  const expanded = isExpanded(node.slug);
  const active = slugEqual(current, node.slug);
  const canExpand = node.kind === "folder";
  const icon = node.kind === "page" ? node.icon : undefined;

  const navigate = () => {
    if (node.kind === "page") router.push(slugToHref(node.slug));
    else toggleExpanded(node.slug);
  };

  return (
    <>
      <div
        className="sidebar-row"
        data-active={active || undefined}
        data-expanded={expanded || undefined}
        style={{ paddingLeft: depth * 14 }}
        onClick={navigate}
        onKeyDown={(e) => {
          if (e.key === "Enter") navigate();
        }}
        role="button"
        tabIndex={0}
      >
        <span
          className="toggle"
          onClick={(e) => {
            e.stopPropagation();
            if (canExpand) toggleExpanded(node.slug);
          }}
          aria-hidden
        >
          {canExpand ? (
            <ChevronRight size={12} />
          ) : (
            <span style={{ width: 12 }} />
          )}
        </span>
        <span className={clsx("icon", { emoji: !!icon })} aria-hidden>
          {icon ? icon : node.kind === "page" ? <FileText size={14} /> : null}
        </span>
        <span className="label">{node.title}</span>
        <span className="actions">
          {node.kind === "folder" && (
            <button
              title="Add a page"
              onClick={(e) => {
                e.stopPropagation();
                onAddPage(node.slug);
              }}
            >
              <Plus size={14} strokeWidth={2.75} />
            </button>
          )}
          <button
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.slug);
            }}
          >
            <Trash2 size={14} />
          </button>
        </span>
      </div>
      {node.kind === "folder" && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeRow
              key={child.slug.join("/")}
              node={child}
              depth={depth + 1}
              current={current}
              isExpanded={isExpanded}
              toggleExpanded={toggleExpanded}
              onAddPage={onAddPage}
              onDelete={onDelete}
            />
          ))}
          {node.children.length === 0 && (
            <AddRow
              depth={depth + 1}
              label="Add page inside"
              onClick={() => onAddPage(node.slug)}
            />
          )}
        </div>
      )}
    </>
  );
}
