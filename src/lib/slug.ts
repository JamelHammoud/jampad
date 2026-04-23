export function slugToHref(slug: string[]): string {
  return "/" + slug.map(encodeURIComponent).join("/");
}

export function slugEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((part, i) => part === b[i]);
}

export function slugStartsWith(slug: string[], prefix: string[]): boolean {
  if (prefix.length > slug.length) return false;
  return prefix.every((part, i) => part === slug[i]);
}

export function decodeSlug(raw: string[]): string[] {
  return raw.map((part) => decodeURIComponent(part));
}

export function slugifyFileName(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return base || `page-${Date.now().toString(36)}`;
}
