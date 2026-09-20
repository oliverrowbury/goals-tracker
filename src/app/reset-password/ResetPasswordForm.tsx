"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Wordmark } from "@/components/Wordmark";
import { PasswordInput } from "@/components/PasswordInput";
import { resetPassword } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-sheen relative w-full overflow-hidden rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? "Saving…" : "Set new password"}
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPassword, null);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-[card-in_0.75s_cubic-bezier(0.16,1,0.3,1)_both] rounded-2xl border border-line bg-card p-7 shadow-lg">
        <h1 className="mb-1 text-3xl text-ink">
          <Wordmark />
        </h1>
        <p className="mb-6 text-sm text-ink-muted">Choose a new password.</p>

        {!token ? (
          <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">
            That reset link is missing its token —{" "}
            <Link href="/forgot-password" className="font-medium underline">
              request a new one
            </Link>
            .
          </p>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="token" value={token} />

            {state?.error && (
              <p className="mb-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">{state.error}</p>
            )}

            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="password">
              New password
            </label>
            <div className="mb-4">
              <PasswordInput
                id="password"
                autoComplete="new-password"
                autoFocus
                required
                minLength={6}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>

            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="confirmPassword">
              Confirm new password
            </label>
            <div className="mb-5">
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>

            <SubmitButton />
          </form>
        )}
      </div>
    </main>
  );
}
