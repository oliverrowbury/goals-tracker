import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

// Next's own default 404 is bare and unstyled — this is the on-brand
// equivalent of error.tsx's "something went wrong" card, for a URL rather
// than a crash. Sits at the app root (not inside a route group) for the
// same reason error.tsx does: it has to catch a path under (main)/ that
// doesn't match any of that group's own routes.
export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-7 text-center shadow-lg">
        <h1 className="mb-1 text-2xl text-ink">
          <Wordmark />
        </h1>
        <p className="mt-4 font-serif text-lg font-semibold text-ink">Page not found</p>
        <p className="mt-1.5 text-sm text-ink-muted">That page doesn&apos;t exist, or it&apos;s moved.</p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
