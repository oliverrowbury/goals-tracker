"use client";

import { useState, useTransition } from "react";
import { toggleDeadlineCompleted } from "./actions";

export function DeadlineCheckbox({ deadlineId, initialCompleted }: { deadlineId: string; initialCompleted: boolean }) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      checked={completed}
      disabled={isPending}
      onChange={() => {
        const next = !completed;
        setCompleted(next); // optimistic
        startTransition(() => {
          toggleDeadlineCompleted(deadlineId);
        });
      }}
      title={completed ? "Mark as not done" : "Mark as done"}
      className="h-4.5 w-4.5 shrink-0 rounded border-line accent-accent"
    />
  );
}
