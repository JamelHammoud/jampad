import { Link } from "@/client/lib/router";
import { Fragment } from "react";
import { humanize } from "@/shared/humanize";
import { useClientConfig } from "./ConfigContext";

export function Breadcrumb({ slug, title }: { slug: string[]; title: string }) {
  const cfg = useClientConfig();
  const items = slug.map((part, i) => {
    const href =
      "/" +
      slug
        .slice(0, i + 1)
        .map(encodeURIComponent)
        .join("/");
    const isLast = i === slug.length - 1;
    const label = isLast ? title : humanize(part);
    return { label, href, isLast };
  });

  return (
    <div className="breadcrumb">
      <Link
        href="/"
        className="crumb"
        data-current={items.length === 0 || undefined}
      >
        {cfg.branding.name}
      </Link>
      {items.map((item) => (
        <Fragment key={item.href}>
          <span className="sep">/</span>
          <Link
            href={item.href}
            className="crumb"
            data-current={item.isLast || undefined}
          >
            {item.label}
          </Link>
        </Fragment>
      ))}
    </div>
  );
}
