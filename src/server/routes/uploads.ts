import { Hono } from "hono";
import { saveUpload } from "@/server/lib/fs";

export const uploadsRoute = new Hono();

uploadsRoute.post("/", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "No file" }, 400);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const url = await saveUpload(buffer, file.name, file.type);
    return c.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return c.json({ error: message }, 400);
  }
});
