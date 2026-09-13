"use client";

import { useTransition } from "react";
import { deleteGoal } from "./actions";

export function DeleteGoalButton({ goalId, title }: { goalId: string; title: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title="Delete goal"
      disabled={isPending}
      onClick={() => {
        if (confirm(`Delete "${title}"? This removes all its history too — this can't be undone.`)) {
          startTransition(() => deleteGoal(goalId));
        }
      }}
      className="text-ink-muted hover:text-accent disabled:opacity-50"
    >
      ×
    </button>
  );
}
