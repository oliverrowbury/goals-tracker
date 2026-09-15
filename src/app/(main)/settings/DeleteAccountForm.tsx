"use client";

import { useActionState, useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { deleteAccount } from "./actions";

export function DeleteAccountForm() {
  const [state, formAction, isPending] = useActionState(deleteAccount, null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-red-600 hover:underline">
        Delete my account
      </button>
    );
  }

  return (
    <form action={formAction} className="max-w-sm space-y-3">
      <p className="text-sm text-ink">
        This permanently deletes your account and everything in it — journal, goals, study history, workouts, photos,
        follows. It can&apos;t be undone.
      </p>
      {state?.error && <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">{state.error}</p>}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="deleteAccountPassword">
          Confirm your password
        </label>
        <PasswordInput
          id="deleteAccountPassword"
          name="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "Deleting…" : "Permanently delete my account"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-sm text-ink-muted hover:text-accent">
          Cancel
        </button>
      </div>
    </form>
  );
}
