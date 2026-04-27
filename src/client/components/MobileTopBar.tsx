import { useCallback } from "react";
import { Menu, Plus, Search } from "lucide-react";
import { Link, useRouter } from "@/client/lib/router";
import { slugToHref } from "@/shared/slug";
import { useClientConfig } from "./ConfigContext";
import { useWorkspace } from "./WorkspaceContext";

export function MobileTopBar({
  onOpenDrawer,
}: {
  onOpenDrawer: () => void;
}) {
  const cfg = useClientConfig();
  const { setPaletteOpen, refresh } = useWorkspace();
  const router = useRouter();

  const newPage = useCallback(async () => {
    const title = `Untitled-${Date.now().toString(36)}`;
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        parentSlug: [],
        title,
        kind: "page",
      }),
    });
    if (!res.ok) return;
    const { slug } = (await res.json()) as { slug: string[] };
    await refresh();
    router.push(slugToHref(slug) + "?new=1");
  }, [refresh, router]);

  return (
    <div className="mobile-topbar">
      <button
        className="icon-btn"
        onClick={onOpenDrawer}
        aria-label="Open menu"
        type="button"
      >
        <Menu size={22} />
      </button>
      <Link href="/" className="brand">
        {cfg.branding.showLogo && cfg.branding.logoImage ? (
          <span className="brand-logo">
            <img src={cfg.branding.logoImage} alt="" />
          </span>
        ) : cfg.branding.showLogo ? (
          <span className="brand-logo">{cfg.branding.logo}</span>
        ) : null}
        {cfg.branding.name && (
          <span className="brand-name">{cfg.branding.name}</span>
        )}
      </Link>
      {cfg.features.search && (
        <button
          className="icon-btn"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search"
          type="button"
        >
          <Search size={20} />
        </button>
      )}
      {cfg.features.newPage && (
        <button
          className="icon-btn"
          onClick={newPage}
          aria-label="New page"
          type="button"
        >
          <Plus size={22} />
        </button>
      )}
    </div>
  );
}
