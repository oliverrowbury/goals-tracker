"use client";

import { useState, useTransition } from "react";
import { setGoalLogValue } from "./actions";

// A manual top-up for an auto-tracked WEEKLY_TARGET goal — the auto-tracked
// source (Study timer / Workout log) might have missed something, so this
// logs extra for today on top of it rather than replacing it. The
// auto-tracked part isn't stored in GoalLog at all, so this manual amount
// only ever adds to the week total (see goals/page.tsx and journal/page.tsx
// where the two are summed), never overwrites it.
export function GoalExtraInput({
  goalId,
  dateISO,
  initialValue,
  unit,
}: {
  goalId: string;
  dateISO: string;
  initialValue: number | null;
  unit: string | null;
}) {
  const [value, setValue] = useState(initialValue ?? 0);
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-muted" title="Forgot to log it automatically? Add extra here.">
      <span>+ extra today</span>
      <input
        type="number"
        min="0"
        step="any"
        disabled={isPending}
        defaultValue={initialValue ?? ""}
        placeholder="0"
        onBlur={(e) => {
          const newValue = Number(e.target.value || 0);
          if (newValue === value) return;
          setValue(newValue);
          startTransition(() => {
            setGoalLogValue(goalId, dateISO, newValue);
          });
        }}
        className="w-14 rounded-md border border-line px-1.5 py-1 text-right text-xs focus:border-goals focus:outline-none"
      />
      {unit && <span>{unit}</span>}
    </label>
  );
}
