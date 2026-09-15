"use client";

import { useState, useTransition } from "react";
import { HeartIcon } from "@/components/Icons";
import { likeActivity, type ActivityKind } from "./actions";

export function LikeButton({
  kind,
  activityId,
  count,
  likedByMe,
}: {
  kind: ActivityKind;
  activityId: string;
  count: number;
  likedByMe: boolean;
}) {
  const [liked, setLiked] = useState(likedByMe);
  const [localCount, setLocalCount] = useState(count);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={liked || isPending}
      onClick={() => {
        setLiked(true); // optimistic
        setLocalCount((c) => c + 1);
        startTransition(() => likeActivity(kind, activityId));
      }}
      title={liked ? "You liked this" : "Like"}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        liked ? "border-calm bg-calm-soft text-calm" : "border-line text-ink-muted hover:border-calm hover:text-calm"
      } disabled:cursor-default`}
    >
      <HeartIcon className="h-4 w-4" filled={liked} />
      {localCount > 0 && <span className="tabular-nums">{localCount}</span>}
    </button>
  );
}
