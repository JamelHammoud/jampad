import { z } from "zod";
import { promises as fsp } from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildTree,
  createPage,
  deleteFolder,
  deletePage,
  readPage,
  renamePage,
  writePage,
} from "@/server/lib/fs";
import { folderFromSlug } from "@/server/lib/paths";
import { searchPages } from "@/server/lib/search";

/**
 * Each tool is a thin wrapper over src/lib/fs.ts (or search.ts). Handlers are
 * exported individually so they can be unit-tested without an MCP transport.
 *
 * Return shape matches the MCP CallToolResult contract: `content` is an array
 * of text blocks. Most handlers JSON-stringify their payload into one block.
 */

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(payload: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function notEmpty(slug: unknown): asserts slug is string[] {
  if (!Array.isArray(slug) || slug.length === 0) {
    throw new Error("slug must be a non-empty string array");
  }
}

export const handlers = {
  async search_pages(args: {
    query: string;
    limit?: number;
  }): Promise<ToolResult> {
    const results = await searchPages(args.query ?? "", args.limit ?? 20);
    return ok({ results });
  },

  async list_pages(args: { folderSlug?: string[] }): Promise<ToolResult> {
    const tree = await buildTree(args.folderSlug ?? []);
    return ok({ tree });
  },

  async read_page(args: { slug: string[] }): Promise<ToolResult> {
    notEmpty(args.slug);
    const page = await readPage(args.slug);
    if (!page) throw new Error(`Page not found: ${args.slug.join("/")}`);
    return ok(page);
  },

  async create_page(args: {
    parentSlug?: string[];
    title: string;
    markdown?: string;
  }): Promise<ToolResult> {
    const title = (args.title ?? "").trim();
    if (!title) throw new Error("title is required");
    const { slugifyFileName } = await import("@/shared/slug");
    const parent = Array.isArray(args.parentSlug) ? args.parentSlug : [];
    const fileName = slugifyFileName(title);
    const slug = [...parent, fileName];
    await createPage(slug, title);
    if (args.markdown) {
      await writePage(slug, { title, markdown: args.markdown });
    }
    return ok({ slug, title });
  },

  async update_page(args: {
    slug: string[];
    title?: string;
    icon?: string | null;
    cover?: string | null;
    markdown?: string;
  }): Promise<ToolResult> {
    notEmpty(args.slug);
    const current = await readPage(args.slug);
    if (!current) throw new Error(`Page not found: ${args.slug.join("/")}`);
    await writePage(args.slug, {
      title: args.title ?? current.title,
      icon: args.icon === undefined ? (current.icon ?? null) : args.icon,
      cover: args.cover === undefined ? (current.cover ?? null) : args.cover,
      markdown: args.markdown ?? current.markdown,
    });
    return ok({ ok: true });
  },

  async rename_page(args: {
    fromSlug: string[];
    toSlug: string[];
  }): Promise<ToolResult> {
    notEmpty(args.fromSlug);
    notEmpty(args.toSlug);
    await renamePage(args.fromSlug, args.toSlug);
    return ok({ slug: args.toSlug });
  },

  async delete_page(args: { slug: string[] }): Promise<ToolResult> {
    notEmpty(args.slug);
    // Match the DELETE branch in /api/pages/[...slug]/route.ts: if a folder
    // exists at the slug, recursively delete it; otherwise delete the .md file.
    const abs = folderFromSlug(args.slug);
    try {
      const stat = await fsp.stat(abs);
      if (stat.isDirectory()) {
        await deleteFolder(args.slug);
      } else {
        await deletePage(args.slug);
      }
    } catch {
      await deletePage(args.slug);
    }
    return ok({ ok: true });
  },
};

export function registerTools(server: McpServer): void {
  server.registerTool(
    "search_pages",
    {
      description:
        "Fuzzy-search pages by title and content. Returns up to `limit` results, ordered by relevance.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "Search query. Empty string lists all pages alphabetically.",
          ),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Max results (default 20)."),
      },
    },
    (args) => handlers.search_pages(args),
  );

  server.registerTool(
    "list_pages",
    {
      description:
        "List the page tree. Returns pages and folders under `folderSlug` (root if omitted).",
      inputSchema: {
        folderSlug: z.array(z.string()).optional(),
      },
    },
    (args) => handlers.list_pages(args),
  );

  server.registerTool(
    "read_page",
    {
      description:
        'Read a single page by slug array (e.g. ["docs", "getting-started"]). Returns title, icon, cover, markdown, updatedAt.',
      inputSchema: {
        slug: z.array(z.string()).min(1),
      },
    },
    (args) => handlers.read_page(args),
  );

  server.registerTool(
    "create_page",
    {
      description:
        "Create a new page under `parentSlug`. Title is auto-slugified for the filename. Optional `markdown` seeds the body.",
      inputSchema: {
        parentSlug: z.array(z.string()).optional(),
        title: z.string().min(1),
        markdown: z.string().optional(),
      },
    },
    (args) => handlers.create_page(args),
  );

  server.registerTool(
    "update_page",
    {
      description:
        "Update fields on an existing page. Unsent fields are preserved. Pass `null` to clear `icon` or `cover`.",
      inputSchema: {
        slug: z.array(z.string()).min(1),
        title: z.string().optional(),
        icon: z.string().nullable().optional(),
        cover: z.string().nullable().optional(),
        markdown: z.string().optional(),
      },
    },
    (args) => handlers.update_page(args),
  );

  server.registerTool(
    "rename_page",
    {
      description:
        "Move/rename a page. Both slugs are full paths (parent chain + new filename).",
      inputSchema: {
        fromSlug: z.array(z.string()).min(1),
        toSlug: z.array(z.string()).min(1),
      },
    },
    (args) => handlers.rename_page(args),
  );

  server.registerTool(
    "delete_page",
    {
      description:
        "Delete a page or an entire folder (recursive) at `slug`. Not recoverable unless the wiki is in git.",
      inputSchema: {
        slug: z.array(z.string()).min(1),
      },
    },
    (args) => handlers.delete_page(args),
  );
}
