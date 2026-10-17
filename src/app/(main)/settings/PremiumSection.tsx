"use client";

import { useState, useTransition } from "react";
import { createCheckoutSession, createBillingPortalSession } from "./actions";
import type { PremiumInterval } from "@/lib/stripe";

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
}: {
  isPremium: boolean;
  hasStripeSubscription: boolean;
  justSubscribed: boolean;
}) {
  if (isPremium) {
    return (
      <div>
        {justSubscribed && (
          <p className="mb-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent-strong">
            🎉 You&apos;re on Proudly Premium — thank you for supporting the app.
          </p>
        )}
        <p className="text-sm text-ink">
          You have <span className="font-medium text-accent">Proudly Premium</span>.
        </p>
        {hasStripeSubscription ? (
          <div className="mt-3">
            <ManageSubscriptionButton />
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">Granted by the Proudly team — nothing to manage here.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <SubscribeButton interval="month" label="£3.99/month" />
      <SubscribeButton interval="year" label="£29.99/year" sublabel="save ~£18 a year" highlight />
    </div>
  );
}
