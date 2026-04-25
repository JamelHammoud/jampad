import { Hono } from "hono";
import { searchPages } from "@/server/lib/search";

export const searchRoute = new Hono();

searchRoute.get("/", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  const results = await searchPages(q, 30);
  return c.json({ results });
});
