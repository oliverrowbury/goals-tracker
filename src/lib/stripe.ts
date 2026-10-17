import Stripe from "stripe";

// Server-only — reads STRIPE_SECRET_KEY from the environment, lazily
// constructed same as lib/ai.ts's Anthropic client, so a dev environment
// with no key set doesn't crash at import time, only when Premium
// checkout/billing is actually used.
let client: Stripe | null = null;
export function getStripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
  return client;
}

// Fixed, inline pricing (Stripe's price_data, not pre-created Price
// objects) — one less thing to set up in the Stripe dashboard, and the
// price living in code means it can't silently drift from what Settings
// displays. Amounts are in pence (Stripe's minor-unit convention).
export const PREMIUM_PRICING = {
  month: { amountPence: 399, label: "£3.99/month" },
  year: { amountPence: 3000, label: "£30/year" },
} as const;

export type PremiumInterval = keyof typeof PREMIUM_PRICING;
