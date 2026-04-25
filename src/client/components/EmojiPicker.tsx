import { useEffect, useRef } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string | undefined) => void;
  anchorRect: DOMRect | null;
  allowRemove?: boolean;
};

export function EmojiPicker({
  open,
  onClose,
  onSelect,
  anchorRect,
  allowRemove,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    setTimeout(() => window.addEventListener("click", onClick), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const PICKER_WIDTH = 352;
  const PICKER_HEIGHT = 420;
  const MARGIN = 8;
  let top = 120;
  let left = 120;
  if (anchorRect) {
    top = anchorRect.bottom + MARGIN;
    left = anchorRect.left;
    if (typeof window !== "undefined") {
      if (left + PICKER_WIDTH > window.innerWidth - MARGIN)
        left = window.innerWidth - PICKER_WIDTH - MARGIN;
      if (top + PICKER_HEIGHT > window.innerHeight - MARGIN)
        top = Math.max(MARGIN, anchorRect.top - PICKER_HEIGHT - MARGIN);
      if (left < MARGIN) left = MARGIN;
    }
  }

  return (
    <div
      ref={ref}
      className="emoji-picker-shell"
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 60,
      }}
    >
      <Picker
        data={data}
        onEmojiSelect={(e: { native: string }) => {
          onSelect(e.native);
          onClose();
        }}
        theme="light"
        navPosition="top"
        previewPosition="none"
        skinTonePosition="search"
        maxFrequentRows={2}
        perLine={9}
        emojiSize={22}
        emojiButtonSize={32}
      />
      {allowRemove && (
        <button
          type="button"
          className="emoji-picker-remove"
          onClick={() => {
            onSelect(undefined);
            onClose();
          }}
        >
          Remove icon
        </button>
      )}
    </div>
  );
}
