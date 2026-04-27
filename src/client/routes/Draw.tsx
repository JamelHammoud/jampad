import { lazy, Suspense, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "@/client/lib/router";
import type { DrawingData } from "@/shared/types";

const DrawingEditor = lazy(() =>
  import("@/client/components/DrawingEditor").then((m) => ({
    default: m.DrawingEditor,
  })),
);

type State =
  | { kind: "loading" }
  | { kind: "ok"; drawing: DrawingData }
  | { kind: "missing" };

export function DrawRoute() {
  const { id = "" } = useParams();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetch(`/api/drawings/${id}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setState({ kind: "missing" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const drawing = (await res.json()) as DrawingData;
        setState({ kind: "ok", drawing });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === "loading") return <DrawSkeleton />;
  if (state.kind === "missing") return <NotFound />;
  return (
    <Suspense fallback={<DrawSkeleton />}>
      <DrawingEditor key={state.drawing.id} initial={state.drawing} />
    </Suspense>
  );
}

function DrawSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="drawing-titlebar">
        <div className="skeleton h-[20px] w-[180px] rounded" />
      </div>
      <div className="flex-1 skeleton" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center gap-4">
      <div className="text-[56px]">🖼️</div>
      <h1 className="text-[22px] font-semibold">Drawing not found</h1>
      <p className="text-[14px]" style={{ color: "var(--fg-60)" }}>
        It may have been deleted, or the link is wrong.
      </p>
      <Link
        href="/draw"
        className="px-4 py-2 rounded-md bg-[color:var(--fg)] text-white text-[14px] font-medium hover:opacity-90"
      >
        Back to drawings
      </Link>
    </div>
  );
}
