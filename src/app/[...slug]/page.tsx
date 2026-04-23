import { notFound } from "next/navigation";
import { readPage } from "@/lib/fs";
import { decodeSlug } from "@/lib/slug";
import { PageView } from "@/components/PageView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string[] }> };

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const decoded = decodeSlug(slug);
  const page = await readPage(decoded);
  if (!page) notFound();
  return <PageView initial={page} />;
}
