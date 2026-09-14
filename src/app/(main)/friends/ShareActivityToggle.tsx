"use client";

import { useState, useTransition } from "react";
import { setShareCategory, type ShareCategory } from "./actions";

const ROWS: { category: ShareCategory; label: string }[] = [
  { category: "journal", label: "Journal streak" },
  { category: "study", label: "Study streak" },
  { category: "workout", label: "Workout streak" },
];

export function ShareActivityToggle({
  initial,
}: {
  initial: { journal: boolean; study: boolean; workout: boolean };
}) {
  const [shared, setShared] = useState(initial);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-ink">Share with friends</p>
      {ROWS.map(({ category, label }) => (
        <label key={category} className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={shared[category]}
            disabled={isPending}
            onChange={() => {
              const next = !shared[category];
              setShared((s) => ({ ...s, [category]: next })); // optimistic
              startTransition(() => setShareCategory(category, next));
            }}
            className="h-4 w-4 rounded border-line accent-calm"
          />
          {label}
        </label>
      ))}
    </div>
  );
}
