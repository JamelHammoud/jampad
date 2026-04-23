import { NextResponse } from "next/server";
import { buildTree } from "@/lib/fs";
import { humanize } from "@/lib/humanize";
import type { SectionGroup, TreeNode } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
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

  return NextResponse.json({ sections });
}
