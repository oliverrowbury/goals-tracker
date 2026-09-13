"use client";

import { useState, useTransition } from "react";
import { toggleGoalCompletion } from "./actions";

export function GoalTodayCheckbox({
  goalId,
  dateISO,
  initialCompleted,
}: {
  goalId: string;
  dateISO: string;
  initialCompleted: boolean;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1.5 text-sm text-ink-muted">
      <input
        type="checkbox"
        checked={completed}
        disabled={isPending}
        onChange={() => {
          const next = !completed;
          setCompleted(next); // optimistic
          startTransition(() => {
            toggleGoalCompletion(goalId, dateISO);
          });
        }}
        className="h-4 w-4 rounded border-line accent-goals"
      />
      Today
    </label>
  );
}
