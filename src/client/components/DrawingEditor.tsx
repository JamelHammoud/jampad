import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { DrawingData } from "@/shared/types";
import { useDebouncedSave } from "./useDebouncedSave";
import { useWorkspace } from "./WorkspaceContext";

// FONT_FAMILY.Helvetica = 2; ROUGHNESS.architect = 0.
const STRAIGHT_DEFAULTS = {
  currentItemRoughness: 0,
  currentItemFontFamily: 2,
} as const;

type Props = {
  initial: DrawingData;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawAPI = any;

export function DrawingEditor({ initial }: Props) {
  const { refreshDrawings } = useWorkspace();
  const apiRef = useRef<ExcalidrawAPI | null>(null);

  const [titleDraft, setTitleDraft] = useState(initial.title);
  const titleRef = useRef(initial.title);

  useEffect(() => {
    setTitleDraft(initial.title);
    titleRef.current = initial.title;
  }, [initial]);

  const lastTitleSavedRef = useRef(initial.title);
  const save = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const body = {
      title: titleRef.current,
      scene: {
        elements: api.getSceneElements(),
        appState: sanitizeAppState(api.getAppState()),
        files: api.getFiles(),
      },
    };
    await fetch(`/api/drawings/${initial.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    if (lastTitleSavedRef.current !== titleRef.current) {
      lastTitleSavedRef.current = titleRef.current;
      refreshDrawings();
    }
  }, [initial.id, refreshDrawings]);

  const { queue: queueSave } = useDebouncedSave(save, 600);

  const initialData = useMemo(
    () => ({
      elements: initial.scene.elements as never,
      appState: {
        ...STRAIGHT_DEFAULTS,
        ...(initial.scene.appState as Record<string, unknown>),
        currentItemRoughness: 0,
        currentItemFontFamily: 2,
        viewBackgroundColor: "#ffffff",
      } as never,
      files: initial.scene.files as never,
      scrollToContent: true,
    }),
    [initial],
  );

  const onChange = useCallback(() => {
    queueSave();
  }, [queueSave]);

  return (
    <div className="drawing-editor">
      <div className="drawing-titlebar">
        <input
          className="drawing-title-input"
          value={titleDraft}
          placeholder="Untitled drawing"
          onChange={(e) => {
            const v = e.target.value;
            setTitleDraft(v);
            titleRef.current = v;
            queueSave();
          }}
        />
      </div>
      <div className="drawing-canvas">
        <Excalidraw
          excalidrawAPI={(api: ExcalidrawAPI) => (apiRef.current = api)}
          initialData={initialData}
          onChange={onChange}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveAsImage: true,
              saveToActiveFile: false,
              export: false,
              clearCanvas: true,
              changeViewBackgroundColor: false,
              toggleTheme: false,
            },
          }}
        />
      </div>
    </div>
  );
}

// Excalidraw's appState carries a lot of transient interaction data
// (cursor, drag offsets, recent colors) that doesn't belong on disk.
function sanitizeAppState(
  appState: Record<string, unknown>,
): Record<string, unknown> {
  const KEEP = new Set([
    "viewBackgroundColor",
    "currentItemFontFamily",
    "currentItemFontSize",
    "currentItemRoughness",
    "currentItemStrokeColor",
    "currentItemBackgroundColor",
    "currentItemFillStyle",
    "currentItemStrokeWidth",
    "currentItemStrokeStyle",
    "currentItemTextAlign",
    "currentItemArrowType",
    "currentItemEndArrowhead",
    "currentItemStartArrowhead",
    "currentItemRoundness",
    "currentItemOpacity",
    "gridSize",
    "gridStep",
    "gridModeEnabled",
    "zoom",
    "scrollX",
    "scrollY",
  ]);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(appState)) {
    if (KEEP.has(key)) out[key] = appState[key];
  }
  return out;
}
