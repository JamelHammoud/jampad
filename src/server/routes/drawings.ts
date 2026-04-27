import { Hono } from "hono";
import {
  createDrawing,
  deleteDrawing,
  listDrawings,
  readDrawing,
  writeDrawing,
} from "@/server/lib/drawings";
import { getConfig } from "@/server/lib/config";

export const drawingsRoute = new Hono();

drawingsRoute.use("*", async (c, next) => {
  if (!getConfig().features.draw) {
    return c.json({ error: "Draw disabled" }, 404);
  }
  await next();
});

drawingsRoute.get("/", async (c) => {
  const drawings = await listDrawings();
  return c.json({ drawings });
});

drawingsRoute.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { title?: string };
  const drawing = await createDrawing(
    typeof body.title === "string" ? body.title : undefined,
  );
  return c.json(drawing);
});

drawingsRoute.get("/:id", async (c) => {
  const drawing = await readDrawing(c.req.param("id"));
  if (!drawing) return c.json({ error: "Not found" }, 404);
  return c.json(drawing);
});

drawingsRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as {
    title?: string;
    scene?: {
      elements?: unknown;
      appState?: unknown;
      files?: unknown;
    };
  } | null;
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid body" }, 400);
  }

  const existing = await readDrawing(id);
  if (!existing) return c.json({ error: "Not found" }, 404);

  if (typeof body.title === "string" && body.title.trim()) {
    existing.title = body.title.trim();
  }
  if (body.scene && typeof body.scene === "object") {
    existing.scene = {
      elements: Array.isArray(body.scene.elements) ? body.scene.elements : [],
      appState:
        body.scene.appState && typeof body.scene.appState === "object"
          ? (body.scene.appState as Record<string, unknown>)
          : {},
      files:
        body.scene.files && typeof body.scene.files === "object"
          ? (body.scene.files as Record<string, unknown>)
          : {},
    };
  }
  existing.updatedAt = new Date().toISOString();
  await writeDrawing(existing);
  return c.json({ ok: true, drawing: existing });
});

drawingsRoute.delete("/:id", async (c) => {
  await deleteDrawing(c.req.param("id"));
  return c.json({ ok: true });
});
