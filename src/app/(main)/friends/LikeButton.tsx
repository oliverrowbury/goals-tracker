"use client";

import { HeartIcon } from "@/components/Icons";

// Purely presentational now — PostPhoto (the double-tap-to-like target)
// and this button both need to act on the same liked/count state, so that
// state lives one level up in PostFooter and gets passed down to both
// instead of each managing its own copy.
export function LikeButton({
  liked,
  count,
  disabled,
  onToggle,
}: {
  liked: boolean;
  count: number;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      title={liked ? "Unlike" : "Like"}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        liked ? "border-calm bg-calm-soft text-calm" : "border-line text-ink-muted hover:border-calm hover:text-calm"
      } disabled:cursor-default disabled:opacity-70`}
    >
      <HeartIcon className="h-4 w-4" filled={liked} />
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}
