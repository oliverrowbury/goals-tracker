import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const errorMessage =
    error === "taken"
      ? "That email already has an account — sign in instead."
      : error === "mismatch"
        ? "Passwords didn't match — try again."
        : error === "short"
          ? "Password needs to be at least 6 characters."
          : error
            ? "Something went wrong — try again."
            : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form
        action="/api/signup"
        method="POST"
        className="w-full max-w-sm animate-[fade-up_0.5s_ease-out_both] rounded-2xl border border-line bg-card p-7 shadow-lg"
      >
        <h1 className="mb-1 text-3xl text-ink">
          <Wordmark />
        </h1>
        <p className="mb-6 text-sm text-ink-muted">Create your own account — your data stays yours alone.</p>

        {errorMessage && (
          <p className="mb-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">{errorMessage}</p>
        )}

        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          autoFocus
          required
          className="mb-4 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mb-4 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          className="mb-4 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          className="mb-4 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />

        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98]"
        >
          Create account
        </button>

        <p className="mt-4 text-center text-sm text-ink-muted">
          Already have one?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
