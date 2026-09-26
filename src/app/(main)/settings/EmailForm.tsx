"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { updateEmail } from "./actions";

export function EmailForm({ current }: { current: string }) {
  const [state, formAction, isPending] = useActionState(updateEmail, null);

  return (
    <form action={formAction} className="max-w-sm space-y-3">
      {state?.error && <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">{state.error}</p>}
      {state?.success && <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">{state.success}</p>}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={current}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="emailPassword">
          Current password
        </label>
        <PasswordInput
          id="emailPassword"
          name="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <p className="mt-1 text-xs text-ink-muted">Needed to confirm it&apos;s really you — this is what you log in and reset your password with.</p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Change email"}
      </button>
    </form>
  );
}
