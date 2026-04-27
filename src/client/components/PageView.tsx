import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { ImagePlus, Smile } from "lucide-react";
import type { PageData } from "@/shared/types";
import { Breadcrumb } from "./Breadcrumb";
import { slugToHref, slugifyFileName } from "@/shared/slug";
import { useWorkspace } from "./WorkspaceContext";
import { EmojiPicker } from "./EmojiPicker";
import { useDebouncedSave } from "./useDebouncedSave";

const Editor = lazy(() => import("./Editor"));

function EditorSkeleton() {
  return (
    <div className="space-y-3 pt-2" aria-hidden>
      <div className="skeleton h-[14px] w-[92%] rounded" />
      <div className="skeleton h-[14px] w-[78%] rounded" />
      <div className="skeleton h-[14px] w-[85%] rounded" />
      <div className="skeleton h-[14px] w-[40%] rounded" />
    </div>
  );
}

type Props = { initial: PageData };

export function PageView({ initial }: Props) {
  const { refresh } = useWorkspace();
  const { search } = useLocation();
  const isNew = new URLSearchParams(search).get("new") === "1";

  const [title, setTitle] = useState(initial.title);
  const [icon, setIcon] = useState<string | undefined>(initial.icon);
  const [cover, setCover] = useState<string | undefined>(initial.cover);
  const [slug, setSlug] = useState<string[]>(initial.slug);
  const [emojiAnchor, setEmojiAnchor] = useState<DOMRect | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const showEmojiPicker = emojiAnchor !== null;
  const openEmoji = (target: Element) =>
    setEmojiAnchor(target.getBoundingClientRect());
  const closeEmoji = () => setEmojiAnchor(null);

  useEffect(() => {
    if (!isNew) return;
    const el = titleInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
    window.history.replaceState(null, "", slugToHref(initial.slug));
  }, [isNew, initial.slug]);

  const state = useRef({
    title: initial.title,
    icon: initial.icon,
    cover: initial.cover,
    slug: initial.slug,
    markdown: initial.markdown,
  });
  useEffect(() => {
    state.current.title = title;
    state.current.icon = icon;
    state.current.cover = cover;
    state.current.slug = slug;
  }, [title, icon, cover, slug]);

  const save = useCallback(async () => {
    const {
      title: t,
      icon: ic,
      cover: cv,
      slug: sl,
      markdown: md,
    } = state.current;
    const payload = {
      title: t,
      icon: ic || null,
      cover: cv || null,
      markdown: md,
    };
    await fetch("/api/pages/" + sl.map(encodeURIComponent).join("/"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});

    const desired = slugifyFileName(t);
    const currentName = sl[sl.length - 1];
    if (desired && desired !== currentName) {
      const toSlug = [...sl.slice(0, -1), desired];
      const res = await fetch(
        "/api/pages/" + sl.map(encodeURIComponent).join("/"),
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ toSlug }),
        },
      ).catch(() => null);
      if (res && res.ok) {
        state.current.slug = toSlug;
        setSlug(toSlug);
        window.history.replaceState(null, "", slugToHref(toSlug));
      }
    }

    await refresh();
  }, [refresh]);

  const { queue: queueSave } = useDebouncedSave(save, 500);

  useEffect(() => {
    setTitle(initial.title);
    setIcon(initial.icon);
    setCover(initial.cover);
    setSlug(initial.slug);
    state.current = {
      title: initial.title,
      icon: initial.icon,
      cover: initial.cover,
      slug: initial.slug,
      markdown: initial.markdown,
    };
  }, [initial]);

  const onTitleChange = (next: string) => {
    setTitle(next);
    state.current.title = next;
    queueSave();
  };

  const onMarkdownChange = (md: string) => {
    state.current.markdown = md;
    queueSave();
  };

  const onIconChange = (next: string | undefined) => {
    setIcon(next);
    state.current.icon = next;
    queueSave();
  };

  const onCoverChange = (next: string | undefined) => {
    setCover(next);
    state.current.cover = next;
    queueSave();
  };

  const handleCoverUpload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    if (!res.ok) return;
    const { url } = (await res.json()) as { url: string };
    onCoverChange(url);
  };

  return (
    <div className="flex flex-col min-h-full page-surface">
      <Breadcrumb slug={slug} title={title} />

      {cover && (
        <div className="w-full h-[20vh] sm:h-[30vh] max-h-[320px] bg-[color:var(--bg-hover)] relative overflow-hidden">
          <img src={cover} alt="" className="w-full h-full object-cover" />
          <button
            className="absolute right-3 bottom-3 sm:right-4 sm:bottom-4 bg-white/80 backdrop-blur text-[13px] px-3 py-1.5 rounded border border-[color:var(--divider)] text-[color:var(--fg-70)] hover:bg-white"
            onClick={() => onCoverChange(undefined)}
          >
            Remove cover
          </button>
        </div>
      )}

      <div className="mx-auto w-full max-w-[720px] px-4 sm:px-12">
        <div className={cover ? "pt-6 sm:pt-10" : "pt-6 sm:pt-24"}>
          {icon && (
            <button
              className="text-[56px] sm:text-[72px] leading-none mb-3 select-none cursor-pointer inline-flex p-1 -ml-1 rounded-lg transition-colors hover:bg-(--bg-hover)"
              onClick={(e) => openEmoji(e.currentTarget)}
              aria-label="Change icon"
              type="button"
            >
              {icon}
            </button>
          )}

          <div className="page-actions-row mb-3 -ml-2">
            {!icon && (
              <button onClick={(e) => openEmoji(e.currentTarget)} type="button">
                <Smile size={16} />
                <span>Add icon</span>
              </button>
            )}
            {!cover && (
              <label>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCoverUpload(file);
                  }}
                />
                <ImagePlus size={16} />
                <span>Add cover</span>
              </label>
            )}
          </div>

          <EmojiPicker
            open={showEmojiPicker}
            onClose={closeEmoji}
            onSelect={(e) => onIconChange(e)}
            anchorRect={emojiAnchor}
            allowRemove={!!icon}
          />

          <input
            ref={titleInputRef}
            className="title-input"
            placeholder="Untitled"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
          />

          <div className="mt-3 pb-24 editor-wrap">
            <Suspense fallback={<EditorSkeleton />}>
              <Editor
                key={slug.join("/")}
                markdown={initial.markdown}
                onChangeMarkdown={onMarkdownChange}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
