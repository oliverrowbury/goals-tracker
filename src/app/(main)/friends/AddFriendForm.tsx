"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendFriendRequest } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-calm px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Sending…" : "Add"}
    </button>
  );
}

export function AddFriendForm() {
  const [state, formAction] = useActionState(sendFriendRequest, null);

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2">
      <input
        name="email"
        type="email"
        required
        placeholder="friend@example.com"
        className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:border-calm focus:outline-none"
      />
      <SubmitButton />
      {state?.error && <p className="w-full text-xs text-accent">{state.error}</p>}
      {state?.success && <p className="w-full text-xs text-calm">{state.success}</p>}
    </form>
  );
}
