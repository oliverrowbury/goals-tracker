// Server/edge-side error monitoring — completely dormant until SENTRY_DSN
// is set (see .env.example). Nothing here breaks the build or the app
// when it's unset; it's just wired up so turning it on later is a matter
// of adding one env var in Vercel, not writing any more code. Sits at
// src/instrumentation.ts (not app/) because that's the one place outside
// the App Router Next.js itself calls register()/onRequestError from,
// regardless of which route actually errors.
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Low — this is a personal-scale app, not a place that needs 100% of
    // requests traced; keeps the free-tier event quota for actual errors.
    tracesSampleRate: 0.1,
  });
}

export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(...args);
  }

  // Stopgap while there's no other way to see what a production error
  // actually was (see ErrorLog's own comment in schema.prisma) — this is
  // the one place Next.js hands over the real error server-side, before
  // it gets redacted down to just a digest for the browser. Best-effort:
  // never let a logging failure make the original error worse.
  try {
    const [error, request] = args;
    const { prisma } = await import("@/lib/prisma");
    await prisma.errorLog.create({
      data: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? (error.stack ?? null) : null,
        path: request?.path ?? null,
      },
    });
  } catch {
    // If even logging the error fails, there's nothing more to do here.
  }
}
