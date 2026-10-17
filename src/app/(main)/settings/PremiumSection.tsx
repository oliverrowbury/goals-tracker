"use client";

import { useState, useTransition } from "react";
import { createCheckoutSession, createBillingPortalSession } from "./actions";
import type { PremiumInterval } from "@/lib/stripe";

const PERKS = [
  "Unlimited goals, deadlines & subjects",
  "Unlimited journal & workout photos",
  "Full weekly recap, every week",
  "A second streak freeze",
  "Exclusive badges & profile flair",
  "PDF exports, emailed automatically",
  "30-day recovery for deleted entries",
  "An earlier deadline reminder",
  "AI workout advice & a personalized daily prompt",
];

function SubscribeButton({
  interval,
  label,
  sublabel,
  highlight,
}: {
  interval: PremiumInterval;
  label: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await createCheckoutSession(interval);
            if (result?.error) setError(result.error);
          });
        }}
        className={`w-full rounded-xl border px-4 py-3 text-center text-sm font-medium transition disabled:opacity-50 ${
          highlight
            ? "border-accent bg-accent text-white hover:opacity-90"
            : "border-line bg-card text-ink hover:border-accent hover:text-accent"
        }`}
      >
        {isPending ? "Redirecting…" : label}
      </button>
      {sublabel && <p className="mt-1 text-center text-xs text-ink-muted">{sublabel}</p>}
      {error && <p className="mt-1 text-center text-xs text-workout">{error}</p>}
    </div>
  );
}

function ManageSubscriptionButton() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await createBillingPortalSession();
            if (result?.error) setError(result.error);
          });
        }}
        className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {isPending ? "Opening…" : "Manage subscription"}
      </button>
      {error && <p className="mt-1 text-xs text-workout">{error}</p>}
    </div>
  );
}

export function PremiumSection({
  isPremium,
  hasStripeSubscription,
  justSubscribed,
  planLabel,
  renewsOn,
  cancelAtPeriodEnd,
}: {
  isPremium: boolean;
  hasStripeSubscription: boolean;
  justSubscribed: boolean;
  // Only meaningful (and only passed) when hasStripeSubscription is true —
  // a real Stripe-managed plan, as opposed to an admin-comped account with
  // nothing to show here.
  planLabel?: string | null;
  renewsOn?: string | null;
  cancelAtPeriodEnd?: boolean;
}) {
  if (isPremium) {
    return (
      <div>
        {justSubscribed && (
          <p className="mb-4 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent-strong">
            🎉 You&apos;re on Proudly Premium — thank you for supporting the app.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3.5">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-accent-strong">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              Active — {hasStripeSubscription ? planLabel ?? "Proudly Premium" : "Proudly Premium"}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {hasStripeSubscription
                ? renewsOn
                  ? cancelAtPeriodEnd
                    ? `Cancels on ${renewsOn} — you'll keep Premium until then.`
                    : `Renews on ${renewsOn}.`
                  : "Billed via Stripe."
                : "Granted by the Proudly team — nothing to manage here."}
            </p>
          </div>
          {hasStripeSubscription && <ManageSubscriptionButton />}
        </div>
      </div>
    );
  }

  return (
    <div>
      <ul className="mb-5 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm text-ink sm:grid-cols-2">
        {PERKS.map((perk) => (
          <li key={perk} className="flex items-start gap-1.5">
            <span className="mt-0.5 text-accent">✓</span>
            {perk}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row">
        <SubscribeButton interval="month" label="£3.99/month" />
        <SubscribeButton interval="year" label="£29.99/year" sublabel="save ~£18 a year" highlight />
      </div>
    </div>
  );
}
