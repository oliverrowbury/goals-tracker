import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { awardBadge } from "@/lib/badges";
import type Stripe from "stripe";

// The only place isPremium actually changes for a real (non-admin-comped)
// subscriber — Checkout and the billing portal both just redirect to
// Stripe-hosted pages, so this webhook is where Stripe tells us what
// happened. Verified by signature (STRIPE_WEBHOOK_SECRET), not a session
// cookie — excluded from proxy.ts's auth matcher for that reason, same as
// the cron routes.
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: "Missing webhook secret or signature" }, { status: 400 });
  }

  // Raw body, not parsed JSON — Stripe's signature is computed over the
  // exact bytes it sent, so parsing (and re-serializing) first would
  // always fail verification.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
      if (!userId || !customerId) break;

      await prisma.user.update({
        where: { id: userId },
        data: { isPremium: true, stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId },
      });
      await awardBadge(userId, "PREMIUM_SUPPORTER");
      break;
    }

    // Covers renewals, upgrades/downgrades, a failed-payment pause, and a
    // scheduled cancellation taking effect — isPremium always tracks
    // whether the subscription is currently in a paying/trialing state.
    //
    // Except it's not the *only* thing that can grant Premium — an invite-a-
    // friend reward (see lib/referral.ts) sets isPremium directly with no
    // Stripe subscription behind it. Someone can have an active referral
    // bonus and separately start (then cancel, or fail to pay for) a real
    // subscription attempt that still got far enough to attach a
    // stripeCustomerId. Without the bonusPremiumUntil check below, this
    // event would force isPremium back to false and silently erase days of
    // unexpired referral Premium that belongs to a completely different
    // feature — one write undoing the other.
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const isActive = subscription.status === "active" || subscription.status === "trialing";

      const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true, bonusPremiumUntil: true } });
      if (!user) break;
      const hasActiveBonus = !!user.bonusPremiumUntil && user.bonusPremiumUntil > new Date();

      await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: isActive || hasActiveBonus, stripeSubscriptionId: subscription.id },
      });
      break;
    }

    // The subscription itself is gone (cancelled and the period ended, or
    // deleted outright) — unlike "updated" with a cancelled-but-still-
    // active status, there's nothing left to track. Same referral-bonus
    // carve-out as "updated" above, for the same reason.
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

      const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true, bonusPremiumUntil: true } });
      if (!user) break;
      const hasActiveBonus = !!user.bonusPremiumUntil && user.bonusPremiumUntil > new Date();

      await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: hasActiveBonus, stripeSubscriptionId: null },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
