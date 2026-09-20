"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Wordmark } from "@/components/Wordmark";
import { requestPasswordReset } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-sheen relative w-full overflow-hidden rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send reset link"}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, null);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-[card-in_0.75s_cubic-bezier(0.16,1,0.3,1)_both] rounded-2xl border border-line bg-card p-7 shadow-lg">
        <h1 className="mb-1 text-3xl text-ink">
          <Wordmark />
        </h1>

        {state?.submitted ? (
          <div className="mt-4">
            <p className="text-sm text-ink">
              If that email has a Proudly account, we&apos;ve sent a link to reset the password — it&apos;s good
              for an hour.
            </p>
            <Link href="/login" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form action={formAction}>
            <p className="mb-6 text-sm text-ink-muted">Enter your email and we&apos;ll send you a reset link.</p>

            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              className="mb-5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />

            <SubmitButton />

            <p className="mt-4 text-center text-sm text-ink-muted">
              <Link href="/login" className="font-medium text-accent hover:underline">
                ← Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
