"use client";

import { useActionState, useEffect, useRef } from "react";
import { createSubject } from "../study/actions";

export function NewSubjectForm() {
  const [state, formAction, isPending] = useActionState(createSubject, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isPending && !state?.error) formRef.current?.reset();
  }, [isPending, state]);

  return (
    <div>
      <form ref={formRef} action={formAction} className="flex max-w-sm gap-2">
        <input
          name="name"
          required
          placeholder="Add a subject…"
          className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {state?.error && <p className="mt-1.5 text-xs text-accent">{state.error}</p>}
    </div>
  );
}
