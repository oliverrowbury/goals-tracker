// Browser-side half of instrumentation.ts's error monitoring — same
// dormant-until-configured deal, just on its own NEXT_PUBLIC_ variable
// since only NEXT_PUBLIC_-prefixed env vars ever reach client-side code.
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
