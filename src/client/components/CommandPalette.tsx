import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/client/lib/router";
import { FileText, Plus, Search } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { slugToHref } from "@/shared/slug";

type Result = { slug: string[]; title: string; snippet?: string };

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, refresh } = useWorkspace();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!paletteOpen) {
      setQ("");
      setResults([]);
      setSelected(0);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 20);
  }, [paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    const ctrl = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        setResults(d.results ?? []);
        setSelected(0);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [q, paletteOpen]);

  const options = useMemo(() => {
    const base: ({ kind: "page"; result: Result } | { kind: "create" })[] =
      results.map((r) => ({ kind: "page", result: r }));
    if (q.trim()) base.push({ kind: "create" });
    return base;
  }, [q, results]);

  const choose = useCallback(
    async (index: number) => {
      const opt = options[index];
      if (!opt) return;
      if (opt.kind === "page") {
        router.push(slugToHref(opt.result.slug));
        setPaletteOpen(false);
        return;
      }
      const title = q.trim();
      if (!title) return;
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parentSlug: [], title, kind: "page" }),
      });
      if (res.ok) {
        const { slug } = (await res.json()) as { slug: string[] };
        await refresh();
        router.push(slugToHref(slug));
      }
      setPaletteOpen(false);
    },
    [options, q, refresh, router, setPaletteOpen],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!paletteOpen) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(options.length - 1, s + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(0, s - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        choose(selected);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, options.length, selected, choose, setPaletteOpen]);

  if (!paletteOpen) return null;

  return (
    <div
      className="cmdk-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) setPaletteOpen(false);
      }}
    >
      <div className="cmdk-modal" role="dialog" aria-label="Quick find">
        <div className="flex items-center gap-2 px-4 border-b border-[color:var(--divider)]">
          <Search size={16} className="text-[color:var(--fg-40)]" />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search or create a page..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ borderBottom: "none" }}
          />
        </div>
        <div className="cmdk-list">
          {options.length === 0 ? (
            <div className="empty-state">No matches</div>
          ) : (
            options.map((opt, i) => {
              if (opt.kind === "create") {
                return (
                  <div
                    key="__create"
                    className="cmdk-item"
                    data-selected={i === selected || undefined}
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => choose(i)}
                  >
                    <Plus size={14} className="text-[color:var(--fg-50)]" />
                    <span>
                      Create "<b>{q.trim()}</b>"
                    </span>
                  </div>
                );
              }
              const r = opt.result;
              return (
                <div
                  key={r.slug.join("/")}
                  className="cmdk-item"
                  data-selected={i === selected || undefined}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => choose(i)}
                >
                  <FileText size={14} className="text-[color:var(--fg-50)]" />
                  <span className="truncate">{r.title}</span>
                  <span className="crumb">
                    {r.slug.slice(0, -1).join(" / ")}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
