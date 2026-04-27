import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { drawingsRoot } from "./paths";
import type { DrawingData, DrawingMeta } from "@/shared/types";

async function ensureRoot() {
  await fs.mkdir(drawingsRoot(), { recursive: true });
}

function drawingPath(id: string) {
  return path.join(drawingsRoot(), `${id}.excalidraw`);
}

// Defensive parse: a drawing file is a JSON envelope with metadata + scene.
// Older files written by Excalidraw directly (no envelope) are tolerated by
// returning empty metadata and using the file mtime.
type StoredEnvelope = {
  jampad?: {
    id?: string;
    title?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  elements?: unknown;
  appState?: unknown;
  files?: unknown;
};

function envelopeOf(
  raw: StoredEnvelope,
  id: string,
  fallbackUpdatedAt: string,
): DrawingData {
  const meta = raw.jampad ?? {};
  return {
    id: String(meta.id ?? id),
    title: String(meta.title ?? "Untitled drawing"),
    createdAt: String(meta.createdAt ?? fallbackUpdatedAt),
    updatedAt: String(meta.updatedAt ?? fallbackUpdatedAt),
    scene: {
      elements: Array.isArray(raw.elements) ? raw.elements : [],
      appState:
        raw.appState && typeof raw.appState === "object"
          ? (raw.appState as Record<string, unknown>)
          : {},
      files:
        raw.files && typeof raw.files === "object"
          ? (raw.files as Record<string, unknown>)
          : {},
    },
  };
}

export async function listDrawings(): Promise<DrawingMeta[]> {
  await ensureRoot();
  const entries = await fs.readdir(drawingsRoot(), { withFileTypes: true });
  const out: DrawingMeta[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".excalidraw")) continue;
    const id = entry.name.slice(0, -".excalidraw".length);
    const abs = path.join(drawingsRoot(), entry.name);
    const stat = await fs.stat(abs).catch(() => null);
    const fallback = stat?.mtime.toISOString() ?? new Date().toISOString();
    let parsed: StoredEnvelope = {};
    try {
      const raw = await fs.readFile(abs, "utf8");
      parsed = JSON.parse(raw) as StoredEnvelope;
    } catch {
      /* keep empty parsed */
    }
    const data = envelopeOf(parsed, id, fallback);
    out.push({
      id: data.id,
      title: data.title,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
  return out.sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );
}

export async function readDrawing(id: string): Promise<DrawingData | null> {
  await ensureRoot();
  const abs = drawingPath(id);
  try {
    const raw = await fs.readFile(abs, "utf8");
    const stat = await fs.stat(abs).catch(() => null);
    const fallback = stat?.mtime.toISOString() ?? new Date().toISOString();
    return envelopeOf(JSON.parse(raw) as StoredEnvelope, id, fallback);
  } catch {
    return null;
  }
}

export async function writeDrawing(drawing: DrawingData): Promise<void> {
  await ensureRoot();
  const envelope = {
    type: "excalidraw",
    version: 2,
    source: "jampad",
    jampad: {
      id: drawing.id,
      title: drawing.title,
      createdAt: drawing.createdAt,
      updatedAt: drawing.updatedAt,
    },
    elements: drawing.scene.elements,
    appState: drawing.scene.appState,
    files: drawing.scene.files,
  };
  await fs.writeFile(
    drawingPath(drawing.id),
    JSON.stringify(envelope, null, 2),
    "utf8",
  );
}

export async function createDrawing(title?: string): Promise<DrawingData> {
  const now = new Date().toISOString();
  const drawing: DrawingData = {
    id: randomUUID(),
    title: title?.trim() || "Untitled drawing",
    createdAt: now,
    updatedAt: now,
    scene: { elements: [], appState: {}, files: {} },
  };
  await writeDrawing(drawing);
  return drawing;
}

export async function deleteDrawing(id: string): Promise<void> {
  await fs.rm(drawingPath(id), { force: true });
}
