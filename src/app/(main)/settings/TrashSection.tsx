"use client";

import { useState, useTransition } from "react";
import { restoreDeletedItem } from "./actions";
import type { TrashedItemSummary } from "@/lib/trash";

function daysLeft(expiresAt: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

function TrashedRow({ item }: { item: TrashedItemSummary }) {
  const [isPending, startTransition] = useTransition();
  const [restored, setRestored] = useState(false);
  const left = daysLeft(item.expiresAt);

  if (restored) return null;

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3">
      <div>
        <p className="text-sm text-ink">{item.label}</p>
        <p className="text-xs text-ink-muted">
          {item.kind === "GOAL" ? "Goal" : "Workout"} · {left === 0 ? "expires today" : `${left} day${left === 1 ? "" : "s"} left`}
        </p>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await restoreDeletedItem(item.id);
            setRestored(true);
          })
        }
        className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {isPending ? "Restoring…" : "Restore"}
      </button>
    </li>
  );
}

export function TrashSection({ items }: { items: TrashedItemSummary[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">Nothing deleted recently.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <TrashedRow key={item.id} item={item} />
      ))}
    </ul>
  );
}
