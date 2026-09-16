import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { PasswordInput } from "@/components/PasswordInput";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from = "/", error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        action="/api/login"
        method="POST"
        className="w-full max-w-sm animate-[fade-in_0.3s_ease-out_both] rounded-2xl border border-line bg-card p-7 shadow-lg"
      >
        {/* Staged entrance — the wordmark settles in first, then the rest
            of the form follows a beat later (animation-delay), rather than
            everything appearing at once. */}
        <h1 className="mb-1 origin-left animate-[logo-in_0.4s_ease-out_both] text-3xl text-ink">
          <Wordmark />
        </h1>

        <div className="animate-[fade-up_0.45s_ease-out_both] [animation-delay:120ms]">
          <p className="mb-6 text-sm text-ink-muted">Sign in to continue.</p>

          {error && (
            <p className="mb-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">
              Wrong email or password — try again.
            </p>
          )}

          <input type="hidden" name="from" value={from} />
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
            className="mb-4 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />

          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="password">
            Password
          </label>
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
            className="w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98]"
          >
            Sign in
          </button>

          <p className="mt-4 text-center text-sm text-ink-muted">
            New here?{" "}
            <Link href="/signup" className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </form>

      <p className="fixed inset-x-0 bottom-4 text-center text-xs text-ink-muted">
        <Link href="/privacy" className="hover:text-accent hover:underline">
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/terms" className="hover:text-accent hover:underline">
          Terms of Service
        </Link>
      </p>
    </main>
  );
}
