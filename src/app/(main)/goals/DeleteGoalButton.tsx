"use client";

import { deleteGoal } from "./actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export function DeleteGoalButton({ goalId, title }: { goalId: string; title: string }) {
  return (
    <ConfirmButton
      triggerClassName="text-ink-muted hover:text-accent disabled:opacity-50"
      title="Delete this goal?"
      message={`Delete "${title}"? This removes all its history too — this can't be undone.`}
      confirmLabel="Delete"
      onConfirm={() => deleteGoal(goalId)}
    >
      Delete
    </ConfirmButton>
  );
}
