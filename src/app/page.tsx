import Link from "next/link";
import { buildTree } from "@/lib/fs";
import { slugToHref } from "@/lib/slug";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cfg = getConfig();
  const tree = await buildTree();
  const firstPage = findFirstPage(tree);

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
        <NewPageButton label={cfg.strings.newPage} />
      </div>
    </div>
  );
}

function findFirstPage(
  nodes: Awaited<ReturnType<typeof buildTree>>,
): string[] | null {
  for (const node of nodes) {
    if (node.kind === "page") return node.slug;
    const child = findFirstPage(node.children);
    if (child) return child;
  }
  return null;
}

function NewPageButton({ label }: { label: string }) {
  return (
    <form
      action={async () => {
        "use server";
        const { createPage } = await import("@/lib/fs");
        const { redirect } = await import("next/navigation");
        const name = `Untitled-${Date.now().toString(36)}`;
        await createPage([name], "Untitled");
        redirect("/" + encodeURIComponent(name));
      }}
    >
      <button
        type="submit"
        className="px-4 py-2 rounded-md border border-[color:var(--divider)] text-[14px] font-medium hover:bg-[color:var(--bg-hover)]"
      >
        + {label}
      </button>
    </form>
  );
}
