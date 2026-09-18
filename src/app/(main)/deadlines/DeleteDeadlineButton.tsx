"use client";

import { deleteDeadline } from "./actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export function DeleteDeadlineButton({ deadlineId, title }: { deadlineId: string; title: string }) {
  return (
    <ConfirmButton
      triggerClassName="text-ink-muted hover:text-accent disabled:opacity-50"
      title="Delete this deadline?"
      message={`Delete "${title}"? This can't be undone.`}
      confirmLabel="Delete"
      onConfirm={() => deleteDeadline(deadlineId)}
    >
      Delete
    </ConfirmButton>
  );
}
