"use client";

import { useTransition } from "react";
import { deleteDeadline } from "./actions";

export function DeleteDeadlineButton({ deadlineId, title }: { deadlineId: string; title: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title="Delete deadline"
      disabled={isPending}
      onClick={() => {
        if (confirm(`Delete "${title}"? This can't be undone.`)) {
          startTransition(() => deleteDeadline(deadlineId));
        }
      }}
      className="text-ink-muted hover:text-accent disabled:opacity-50"
    >
      ×
    </button>
  );
}
