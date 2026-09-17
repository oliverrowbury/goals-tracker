"use client";

import { useFormStatus } from "react-dom";
import { renameSubject } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function RenameSubjectForm({ subjectId, name }: { subjectId: string; name: string }) {
  return (
    <form action={renameSubject.bind(null, subjectId)} className="flex flex-1 gap-2">
      <input
        name="name"
        defaultValue={name}
        className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
      />
      <SubmitButton />
    </form>
  );
}
