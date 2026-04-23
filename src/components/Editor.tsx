"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { useEffect, useRef } from "react";
import type { Block, BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { useDebouncedSave } from "./useDebouncedSave";

// Image width persistence: BlockNote rewrites its markdown on round-trip and
// drops the `previewWidth` prop. We bridge it with raw <img> HTML tags so
// markdown saved with a width survives reload.

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isEmptyParagraph(b: Block): boolean {
  if (b.type !== "paragraph") return false;
  const content = (b as { content?: unknown }).content;
  if (!content) return true;
  if (!Array.isArray(content) || content.length === 0) return true;
  return content.every((c) => {
    const text = (c as { text?: unknown })?.text;
    return typeof text === "string" && text.trim() === "";
  });
}

type ImageMeta = { url: string; width?: number; caption?: string };

function collectImages(blocks: readonly Block[]): ImageMeta[] {
  const out: ImageMeta[] = [];
  const walk = (nodes: readonly Block[]) => {
    for (const b of nodes) {
      if (b.type === "image") {
        const p = b.props as Record<string, unknown>;
        const url = typeof p.url === "string" ? p.url : "";
        if (url) {
          const width =
            typeof p.previewWidth === "number"
              ? p.previewWidth
              : typeof p.width === "number"
                ? (p.width as number)
                : undefined;
          out.push({
            url,
            width,
            caption: typeof p.caption === "string" ? p.caption : "",
          });
        }
      }
      if (b.children?.length) walk(b.children);
    }
  };
  walk(blocks);
  return out;
}

async function blocksToMd(editor: BlockNoteEditor): Promise<string> {
  const blocks = editor.document;
  const parts: string[] = [];
  for (const b of blocks) {
    if (isEmptyParagraph(b)) {
      parts.push(" ");
    } else {
      const singleMd = await editor.blocksToMarkdownLossy([b as PartialBlock]);
      parts.push(singleMd.replace(/\n+$/, ""));
    }
  }
  let md = parts.join("\n\n");
  if (md && !md.endsWith("\n")) md += "\n";

  for (const { url, width, caption } of collectImages(blocks)) {
    if (!width) continue;
    const pattern = new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegex(url)}\\)`, "g");
    md = md.replace(
      pattern,
      `<img src="${escapeAttr(url)}" alt="${escapeAttr(caption ?? "")}" width="${Math.round(width)}" />`,
    );
  }
  return md;
}

async function mdToBlocks(
  editor: BlockNoteEditor,
  markdown: string,
): Promise<PartialBlock[]> {
  const widths = new Map<string, { width: number; caption: string }>();
  const preprocessed = markdown.replace(
    /<img\s+([^>]+?)\/?>/gi,
    (match, attrs: string) => {
      const src = /src\s*=\s*"([^"]+)"/i.exec(attrs)?.[1];
      if (!src) return match;
      const width = /width\s*=\s*"?(\d+)/i.exec(attrs)?.[1];
      const alt = /alt\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? "";
      if (width) widths.set(src, { width: parseInt(width, 10), caption: alt });
      return `![${alt}](${src})`;
    },
  );

  const blocks = (await editor.tryParseMarkdownToBlocks(
    preprocessed,
  )) as Block[];
  return patchBlocks(blocks, widths);
}

function patchBlocks(
  blocks: Block[],
  widths: Map<string, { width: number; caption: string }>,
): PartialBlock[] {
  return blocks.map((b): PartialBlock => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = { ...b };
    if (b.type === "image") {
      const p = b.props as Record<string, unknown>;
      const url = typeof p.url === "string" ? p.url : "";
      const meta = widths.get(url);
      if (meta)
        out.props = { ...(b.props as object), previewWidth: meta.width };
    }
    if (b.type === "paragraph") {
      const content = (b as { content?: unknown }).content;
      if (Array.isArray(content) && content.length === 1) {
        const c = content[0] as { text?: unknown };
        if (
          typeof c?.text === "string" &&
          // NBSP (U+00A0) is used on the markdown side to encode empty
          // paragraphs; strip it before deciding the block is blank.
          // eslint-disable-next-line no-irregular-whitespace
          c.text.replace(/ /g, "").trim() === ""
        ) {
          out.content = [];
        }
      }
    }
    if (b.children?.length) {
      out.children = patchBlocks(b.children as Block[], widths);
    }
    return out;
  });
}

type Props = {
  markdown: string;
  onChangeMarkdown: (md: string) => void;
};

export default function Editor({ markdown, onChangeMarkdown }: Props) {
  const editor = useCreateBlockNote({
    uploadFile: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = (await res.json()) as { url: string };
      return data.url;
    },
  });

  const loadedRef = useRef(false);
  const lastMarkdownRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const patched = await mdToBlocks(editor, markdown || "");
      if (cancelled) return;
      const existing = editor.document;
      editor.replaceBlocks(
        existing,
        patched.length === 0
          ? [{ type: "paragraph", content: [] } as PartialBlock]
          : patched,
      );
      lastMarkdownRef.current = markdown;
      loadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const { queue: queueSave } = useDebouncedSave(async () => {
    const md = await blocksToMd(editor);
    if (md === lastMarkdownRef.current) return;
    lastMarkdownRef.current = md;
    onChangeMarkdown(md);
  }, 500);

  const handleChange = () => {
    if (!loadedRef.current) return;
    queueSave();
  };

  return (
    <BlockNoteView
      editor={editor}
      theme="light"
      onChange={handleChange}
      slashMenu={true}
      formattingToolbar={true}
      sideMenu={true}
      linkToolbar={true}
      tableHandles={true}
      filePanel={true}
      emojiPicker={true}
    />
  );
}
