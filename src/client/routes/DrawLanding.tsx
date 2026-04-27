import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Plus, Shapes } from "lucide-react";
import { useWorkspace } from "@/client/components/WorkspaceContext";

type State =
  | { kind: "loading" }
  | { kind: "redirect"; id: string }
  | { kind: "empty" };

export function DrawLandingRoute() {
  const navigate = useNavigate();
  const { refreshDrawings } = useWorkspace();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetch("/api/drawings").then((r) => r.json());
      if (cancelled) return;
      const drawings = (list.drawings ?? []) as { id: string }[];
      if (drawings.length > 0) {
        setState({ kind: "redirect", id: drawings[0].id });
        return;
      }
      setState({ kind: "empty" });
    })().catch(() => setState({ kind: "empty" }));
    return () => {
      cancelled = true;
    };
  }, []);

  const onNewDrawing = async () => {
    const res = await fetch("/api/drawings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { id: string };
    await refreshDrawings();
    navigate(`/draw/${data.id}`);
  };

  if (state.kind === "loading") return null;
  if (state.kind === "redirect")
    return <Navigate to={`/draw/${state.id}`} replace />;

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 sm:px-8 py-10 text-center">
      <div className="text-[color:var(--fg-50)] mb-3">
        <Shapes size={48} strokeWidth={1.4} />
      </div>
      <h1
        className="text-[22px] font-semibold mb-1"
        style={{ color: "var(--fg)" }}
      >
        No drawings yet
      </h1>
      <p
        className="text-[14px] mb-6 max-w-[420px]"
        style={{ color: "var(--fg-60)" }}
      >
        Start a new drawing to sketch ideas, diagrams, or anything in between.
      </p>
      <button
        onClick={onNewDrawing}
        type="button"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[color:var(--fg)] text-white text-[14px] font-medium hover:opacity-90"
      >
        <Plus size={16} />
        New drawing
      </button>
    </div>
  );
}
