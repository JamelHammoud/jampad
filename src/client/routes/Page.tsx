import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "@/client/lib/router";
import { PageView } from "@/client/components/PageView";
import { PageSkeleton } from "@/client/components/PageSkeleton";
import type { PageData } from "@/shared/types";

function slugFromPath(pathname: string): string[] {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((p) => decodeURIComponent(p));
}

type State =
  | { kind: "loading" }
  | { kind: "ok"; page: PageData }
  | { kind: "missing" };

export function PageRoute() {
  const { pathname } = useLocation();
  const slug = slugFromPath(pathname);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetch("/api/pages/" + slug.map(encodeURIComponent).join("/"))
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setState({ kind: "missing" });
          return;
        }
        if (!res.ok) throw new Error(`status ${res.status}`);
        const page = (await res.json()) as PageData;
        setState({ kind: "ok", page });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "missing" });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (state.kind === "loading") return <PageSkeleton />;
  if (state.kind === "ok") return <PageView initial={state.page} />;
  return <NotFound />;
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center gap-4">
      <div className="text-[56px]">🌫️</div>
      <h1 className="text-[22px] font-semibold">Page not found</h1>
      <p className="text-[14px]" style={{ color: "var(--fg-60)" }}>
        The page you're looking for doesn't exist.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-md bg-[color:var(--fg)] text-white text-[14px] font-medium hover:opacity-90"
      >
        Go home
      </Link>
    </div>
  );
}
