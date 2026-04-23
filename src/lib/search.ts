import Fuse from "fuse.js";
import { listAllPagesFlat } from "./fs";

export type SearchResult = {
  slug: string[];
  title: string;
  snippet: string;
  score?: number;
};

const DEFAULT_LIMIT = 30;
const SNIPPET_LENGTH = 240;

export async function searchPages(
  query: string,
  limit: number = DEFAULT_LIMIT,
): Promise<SearchResult[]> {
  const pages = await listAllPagesFlat();
  const index = pages.map((p) => ({
    slug: p.slug,
    title: p.title,
    snippet: p.markdown.slice(0, SNIPPET_LENGTH),
  }));

  const q = query.trim();
  if (!q) {
    return [...index]
      .sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      )
      .slice(0, limit);
  }

  const fuse = new Fuse(index, {
    keys: [
      { name: "title", weight: 0.7 },
      { name: "snippet", weight: 0.3 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
  });

  return fuse
    .search(q)
    .slice(0, limit)
    .map((r) => ({ ...r.item, score: r.score }));
}
