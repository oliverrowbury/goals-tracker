import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { REFERRAL_REWARD_DAYS } from "@/lib/constants";

// No 0/O, 1/I/L — easy to misread or mistype when someone's reading a code
// off a friend's screen rather than tapping a link.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return code;
}

// Idempotent and lazy — most accounts never call this until they open
// Settings' "Invite friends" section for the first time, rather than every
// account getting a code it'll likely never use at signup.
export async function getOrCreateReferralCode(userId: string, existingCode: string | null): Promise<string> {
  if (existingCode) return existingCode;

  // Collisions are vanishingly unlikely at 32^6 combinations, but a short
  // retry loop costs nothing and turns the @unique constraint into a retry
  // instead of a 500 on the one-in-a-billion clash.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch (err) {
      const e = err as { code?: string };
      if (e?.code !== "P2002") throw err;
    }
  }
  throw new Error("Could not allocate a referral code");
}

// Both sides get the same reward once the referred account actually
// finishes onboarding (see onboarding/actions.ts's completeProfile) — not
// at signup itself, which would cost nothing to fake with throwaway
// accounts. Stacks on top of any unexpired bonus either side already has
// rather than resetting the clock backwards.
export async function grantReferralReward(refereeId: string, referrerId: string): Promise<void> {
  const now = new Date();
  const rewardUntil = new Date(now.getTime() + REFERRAL_REWARD_DAYS * 24 * 60 * 60 * 1000);

  const referrer = await prisma.user.findUnique({ where: { id: referrerId }, select: { bonusPremiumUntil: true } });
  if (!referrer) return; // referrer's account was deleted since this signup — nothing left to credit

  const referrerUntil = referrer.bonusPremiumUntil && referrer.bonusPremiumUntil > rewardUntil ? referrer.bonusPremiumUntil : rewardUntil;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: refereeId },
      data: { isPremium: true, bonusPremiumUntil: rewardUntil, referralRewardGrantedAt: now },
    }),
    prisma.user.update({
      where: { id: referrerId },
      data: { isPremium: true, bonusPremiumUntil: referrerUntil },
    }),
  ]);
}
