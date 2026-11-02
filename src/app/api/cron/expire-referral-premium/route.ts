import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Daily sweep for isPremium flipped on purely by an invite-a-friend reward
// (see lib/referral.ts) whose window has run out. Scoped to
// stripeSubscriptionId: null so this can never touch a real paying
// customer or an admin-comped account that never had a referral bonus in
// the first place — bonusPremiumUntil stays null forever for both, so
// they never match this query at all. Clearing bonusPremiumUntil to null
// in the same write (not just isPremium) means a row only ever matches
// this query once, even if the account is later re-comped some other way.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count } = await prisma.user.updateMany({
    where: { bonusPremiumUntil: { lt: new Date() }, stripeSubscriptionId: null },
    data: { isPremium: false, bonusPremiumUntil: null },
  });

  return NextResponse.json({ expired: count });
}
