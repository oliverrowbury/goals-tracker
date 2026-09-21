"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

// Root-level error boundary — catches anything an app page (or a shared
// layout like (main)/layout.tsx) throws that isn't handled closer to where
// it happened, so a crash lands on this instead of Next's bare, unstyled
// default. Sits at the true app root (not inside a route group) since a
// route group's own error.tsx can't catch an error thrown by ITS OWN
// layout.tsx — only by that layout's children.
export default function GlobalErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Picked up automatically once SENTRY_DSN is set (see
    // instrumentation.ts) — logged either way so it's at least visible in
    // Vercel's function logs today.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-7 text-center shadow-lg">
        <h1 className="mb-1 text-2xl text-ink">
          <Wordmark />
        </h1>
        <p className="mt-4 font-serif text-lg font-semibold text-ink">Something went wrong</p>
        <p className="mt-1.5 text-sm text-ink-muted">
          That page hit an error on our end — not something you did. Try again, or head back home.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
          >
            Try again
          </button>
          <Link href="/" className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
