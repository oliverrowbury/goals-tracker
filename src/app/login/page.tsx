import { Wordmark } from "@/components/Wordmark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from = "/", error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form
        action="/api/login"
        method="POST"
        className="w-full max-w-sm rounded-2xl border border-line bg-card p-7 shadow-sm"
      >
        <h1 className="mb-1 text-3xl text-ink">
          <Wordmark />
        </h1>
        <p className="mb-6 text-sm text-ink-muted">Enter the password to continue.</p>

        {error && (
          <p className="mb-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">
            Wrong password — try again.
          </p>
        )}

        <input type="hidden" name="from" value={from} />
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          required
          className="mb-4 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />

        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-strong"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
