"use client";

import { useState, useTransition } from "react";
import { sendCheer } from "./actions";

export function CheerButton({
  friendUserId,
  count,
  cheeredToday,
}: {
  friendUserId: string;
  count: number;
  cheeredToday: boolean;
}) {
  const [cheered, setCheered] = useState(cheeredToday);
  const [localCount, setLocalCount] = useState(count);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={cheered || isPending}
      onClick={() => {
        setCheered(true); // optimistic
        setLocalCount((c) => c + 1);
        startTransition(() => sendCheer(friendUserId));
      }}
      title={cheered ? "You cheered them on today" : "Proud of you"}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        cheered ? "border-calm bg-calm-soft text-calm" : "border-line text-ink-muted hover:border-calm hover:text-calm"
      } disabled:cursor-default`}
    >
      👏 Proud of you
      {localCount > 0 && <span className="tabular-nums">{localCount}</span>}
    </button>
  );
}
