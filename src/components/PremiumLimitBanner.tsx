import Link from "next/link";

// Shown wherever a free-tier cap blocks creating something new (goals,
// deadlines, subjects) — same shape every time so hitting any one of
// them feels like a consistent, expected part of the app rather than a
// one-off error message.
export function PremiumLimitBanner({ what }: { what: string }) {
  return (
    <div className="mb-4 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent-strong">
      You&apos;ve hit the free limit of {what} on Proudly Normal.{" "}
      <Link href="/settings#premium" className="font-medium underline">
        Go Premium
      </Link>{" "}
      for more.
    </div>
  );
}
