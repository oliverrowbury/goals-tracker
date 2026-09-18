"use client";

import { deleteSubject } from "./actions";
import { formatMinutes } from "@/lib/study";
import { ConfirmButton } from "@/components/ConfirmButton";

export function DeleteSubjectButton({ subjectId, name, minutes }: { subjectId: string; name: string; minutes: number }) {
  const message =
    minutes > 0
      ? `Delete "${name}"? You've logged ${formatMinutes(minutes)} against it — deleting the subject deletes that study history too. This can't be undone.`
      : `Delete "${name}"? This can't be undone.`;

  return (
    <ConfirmButton
      triggerClassName="text-sm text-ink-muted hover:text-accent disabled:opacity-50"
      title="Delete this subject?"
      message={message}
      confirmLabel="Delete"
      onConfirm={() => deleteSubject(subjectId)}
    >
      Delete
    </ConfirmButton>
  );
}
