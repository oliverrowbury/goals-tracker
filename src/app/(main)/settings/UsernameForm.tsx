"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateUsername, type SettingsActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-line px-4 py-2 text-sm text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function UsernameForm({
  current,
  cooldownDaysLeft,
}: {
  current: string;
  cooldownDaysLeft: number;
}) {
  const [state, formAction] = useActionState<SettingsActionState, FormData>(updateUsername, null);

  const locked = cooldownDaysLeft > 0 && !state; // a server response (error/success) takes over the message

  return (
    <div>
      <form action={formAction} className="flex max-w-sm gap-2">
        <div className="flex flex-1 items-center rounded-lg border border-line bg-paper px-3 focus-within:border-accent">
          <span className="text-sm text-ink-muted">@</span>
          <input
            name="username"
            defaultValue={current}
            required
            className="w-full bg-transparent py-2 pl-0.5 text-sm text-ink focus:outline-none"
          />
        </div>
        <SubmitButton />
      </form>
      {state?.error && <p className="mt-1 text-xs text-accent">{state.error}</p>}
      {state?.success && <p className="mt-1 text-xs text-calm">{state.success}</p>}
      {locked && (
        <p className="mt-1 text-xs text-ink-muted">
          You can change it again in {cooldownDaysLeft} day{cooldownDaysLeft === 1 ? "" : "s"}.
        </p>
      )}
      <p className="mt-1 text-xs text-ink-muted">Used by friends to find and add you — see it on /friends.</p>
    </div>
  );
}
