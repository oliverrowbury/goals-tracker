"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState(changePassword, null);

  return (
    <form action={formAction} className="max-w-sm space-y-3">
      {state?.error && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">{state.error}</p>
      )}
      {state?.success && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">{state.success}</p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="currentPassword">
          Current password
        </label>
        <PasswordInput
          id="currentPassword"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="newPassword">
          New password
        </label>
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          required
          minLength={6}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="confirmPassword">
          Confirm new password
        </label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          required
          minLength={6}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
      >
        {isPending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
