import { Hono } from "hono";
import { buildTree } from "@/server/lib/fs";
import { humanize } from "@/shared/humanize";
import type { SectionGroup, TreeNode } from "@/shared/types";

export const treeRoute = new Hono();

treeRoute.get("/", async (c) => {
  const root = await buildTree([]);
  const sections: SectionGroup[] = [];
  const looseChildren: TreeNode[] = [];

  for (const node of root) {
    if (node.kind === "folder") {
      sections.push({
        key: node.name,
        label: humanize(node.name),
        slug: node.slug,
        tree: node.children,
      });
    } else {
      looseChildren.push(node);
    }
  }

  if (looseChildren.length) {
    sections.unshift({
      key: "__root",
      label: "Workspace",
      slug: [],
      tree: looseChildren,
    });
  }

  return c.json({ sections });
});
