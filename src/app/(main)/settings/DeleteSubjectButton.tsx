"use client";

import { useTransition } from "react";
import { deleteSubject } from "./actions";
import { formatMinutes } from "@/lib/study";

export function DeleteSubjectButton({ subjectId, name, minutes }: { subjectId: string; name: string; minutes: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title="Delete subject"
      disabled={isPending}
      onClick={() => {
        const warning =
          minutes > 0
            ? `Delete "${name}"? You've logged ${formatMinutes(minutes)} against it — deleting the subject deletes that study history too. This can't be undone.`
            : `Delete "${name}"? This can't be undone.`;
        if (confirm(warning)) {
          startTransition(() => deleteSubject(subjectId));
        }
      }}
      className="text-ink-muted hover:text-accent disabled:opacity-50"
    >
      ×
    </button>
  );
}
