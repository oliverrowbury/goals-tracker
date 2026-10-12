"use client";

import { useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { PasswordInput } from "@/components/PasswordInput";

// Plain POST to /api/login (not a Server Action — the route sets an
// httpOnly cookie and redirects) so useFormStatus doesn't apply here the
// way it does on every other form in the app. A local pending flag, set
// on submit, covers the same "can't double-tap while it's working" guard:
// a double-tap on a slow connection would otherwise count as two failed
// attempts toward the lockout for one real typo. No need to reset it —
// the page always navigates away next, either to a redirect on success
// or back here with ?error= on failure, which naturally clears state.
export function LoginForm({ error, created }: { error?: string; created?: boolean }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action="/api/login"
      method="POST"
      onSubmit={() => setPending(true)}
      className="relative z-10 w-full max-w-sm animate-[card-in_0.75s_cubic-bezier(0.16,1,0.3,1)_both] rounded-2xl border border-line bg-card p-7 shadow-lg"
    >
      {/* Staged entrance — the card itself settles first, then the
          wordmark (word fades/scales in, then its bars grow up in
          sequence — see Wordmark's `animated` prop), then the rest of
          the form follows once that's mostly done (animation-delay),
          rather than everything appearing at once. */}
      <h1 className="mb-1 text-3xl text-ink">
        <Wordmark animated />
      </h1>

      <div className="animate-[fade-up_0.6s_cubic-bezier(0.16,1,0.3,1)_both] [animation-delay:1s]">
        <p className="mb-6 text-sm text-ink-muted">Sign in to continue.</p>

        {created && (
          <p className="mb-4 rounded-md bg-calm-soft px-3 py-2 text-sm text-calm-strong">
            Account created. Sign in to get started.
          </p>
        )}

        {error === "locked" && (
          <p className="mb-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">
            Too many wrong attempts. This account is locked for 15 minutes. Use{" "}
            <Link href="/forgot-password" className="font-medium underline">
              forgot password
            </Link>{" "}
            if you need in sooner.
          </p>
        )}
        {error && error !== "locked" && (
          <p className="mb-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">
            Wrong email/username or password. Try again.
          </p>
        )}

        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="identifier">
          Email or username
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoFocus
          required
          className="mb-4 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />

        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium text-ink" htmlFor="password">
            Password
          </label>
          <Link href="/forgot-password" className="text-xs font-medium text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="mb-4">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="btn-sheen relative w-full overflow-hidden rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-4 text-center text-sm text-ink-muted">
          New here?{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </form>
  );
}
