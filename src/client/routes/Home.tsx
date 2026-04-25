import { useEffect, useState } from "react";
import { Link } from "@/client/lib/router";
import { useNavigate } from "react-router-dom";
import { useClientConfig } from "@/client/components/ConfigContext";
import { useWorkspace } from "@/client/components/WorkspaceContext";
import { slugToHref } from "@/shared/slug";
import type { TreeNode, SectionGroup } from "@/shared/types";

function findFirstPage(sections: SectionGroup[]): string[] | null {
  function walk(nodes: TreeNode[]): string[] | null {
    for (const node of nodes) {
      if (node.kind === "page") return node.slug;
      const child = walk(node.children);
      if (child) return child;
    }
    return null;
  }
  for (const section of sections) {
    const found = walk(section.tree);
    if (found) return found;
  }
  return null;
}

export function HomeRoute() {
  const cfg = useClientConfig();
  const { sections, refresh } = useWorkspace();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const firstPage = findFirstPage(sections);

  useEffect(() => {
    document.title = cfg.branding.name;
  }, [cfg.branding.name]);

  const onNewPage = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const name = `Untitled-${Date.now().toString(36)}`;
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parentSlug: [], title: name, kind: "page" }),
      });
      if (res.ok) {
        const { slug } = (await res.json()) as { slug: string[] };
        await refresh();
        navigate(slugToHref(slug));
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      {cfg.branding.showLogo && cfg.branding.logoImage ? (
        <img
          src={cfg.branding.logoImage}
          alt={cfg.branding.name}
          className="w-[72px] h-[72px] rounded-lg mb-2 object-cover"
        />
      ) : cfg.branding.showLogo ? (
        <div className="text-[72px] mb-2">{cfg.branding.logo}</div>
      ) : null}
      <h1 className="text-[28px] font-bold mb-1" style={{ color: "var(--fg)" }}>
        {cfg.branding.name}
      </h1>
      <p
        className="text-[14px] mb-8 max-w-[420px]"
        style={{ color: "var(--fg-60)" }}
      >
        {cfg.strings.homeTagline}
      </p>
      <div className="flex gap-2">
        {firstPage ? (
          <Link
            href={slugToHref(firstPage)}
            className="px-4 py-2 rounded-md bg-[color:var(--fg)] text-white text-[14px] font-medium hover:opacity-90"
          >
            Open a page
          </Link>
        ) : null}
        {cfg.features.newPage ? (
          <button
            onClick={onNewPage}
            disabled={creating}
            type="button"
            className="px-4 py-2 rounded-md border border-[color:var(--divider)] text-[14px] font-medium hover:bg-[color:var(--bg-hover)] disabled:opacity-50"
          >
            + {cfg.strings.newPage}
          </button>
        ) : null}
      </div>
    </div>
  );
}
