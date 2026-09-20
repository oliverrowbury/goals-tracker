import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { PasswordInput } from "@/components/PasswordInput";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Ambient glow — the one bit of continuous motion on this page,
          same "always something quietly alive" idea as the breathing
          exercise's halo. Two blobs drifting at different speeds/phases
          for a little parallax depth, rather than one flat glow. Purely
          decorative (aria-hidden), sits behind the card via z-index, not
          interactive. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-accent opacity-0 blur-2xl [animation:glow-in_2.2s_ease-out_0.2s_forwards,glow-drift_20s_ease-in-out_infinite_2.4s]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-64 w-64 -translate-x-[65%] -translate-y-[35%] rounded-[45%] bg-calm opacity-0 blur-2xl [animation:glow-in-soft_2.6s_ease-out_0.5s_forwards,glow-drift-reverse_26s_ease-in-out_infinite_3.1s]"
      />

      <form
        action="/api/login"
        method="POST"
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

          {error === "locked" && (
            <p className="mb-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">
              Too many wrong attempts — this account is locked for 15 minutes. Use{" "}
              <Link href="/forgot-password" className="font-medium underline">
                forgot password
              </Link>{" "}
              if you need in sooner.
            </p>
          )}
          {error && error !== "locked" && (
            <p className="mb-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">
              Wrong email or password — try again.
            </p>
          )}

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
            className="btn-sheen relative w-full overflow-hidden rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98]"
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
