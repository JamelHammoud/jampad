import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center gap-4">
      <div className="text-[56px]">🌫️</div>
      <h1 className="text-[22px] font-semibold">Page not found</h1>
      <p className="text-[14px]" style={{ color: "var(--fg-60)" }}>
        The page you're looking for doesn't exist.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-md bg-[color:var(--fg)] text-white text-[14px] font-medium hover:opacity-90"
      >
        Go home
      </Link>
    </div>
  );
}
