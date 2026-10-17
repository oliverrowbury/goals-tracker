import { prisma } from "@/lib/prisma";
import { awardLevelBadges } from "@/lib/badges";

// Flat amounts per action — simple on purpose (no streak multipliers, no
// difficulty weighting) so the total stays easy to reason about. Goals are
// worth less since a single day can rack up several of them.
export const XP_AWARDS = {
  JOURNAL_ENTRY: 10,
  STUDY_SESSION: 15,
  WORKOUT: 20,
  GOAL_COMPLETE: 5,
  DEADLINE_COMPLETE: 15,
} as const;

const XP_PER_LEVEL = 100;

export function levelForXp(xp: number): { level: number; xpIntoLevel: number; xpForNextLevel: number } {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp - (level - 1) * XP_PER_LEVEL;
  return { level, xpIntoLevel, xpForNextLevel: XP_PER_LEVEL };
}

// An atomic increment, not a read-then-write — two XP-awarding actions
// landing close together (e.g. ticking off two goals in quick succession)
// would otherwise both read the same starting xp and one award would
// silently overwrite the other instead of adding to it.
//
// Clamped at 0 so an undo (e.g. un-ticking a goal) can't push a user
// negative — see toggleGoalCompletion, the only caller that ever passes a
// negative amount. The clamp itself is a separate, idempotent follow-up
// write rather than part of the same atomic step, which is fine: it only
// ever sets xp to exactly 0, so two of them racing still lands on 0.
export async function awardXp(userId: string, amount: number) {
  const { xp, isPremium } = await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
    select: { xp: true, isPremium: true },
  });

  if (xp < 0) {
    await prisma.user.update({ where: { id: userId }, data: { xp: 0 } });
  }

  const { level } = levelForXp(Math.max(xp, 0));
  await awardLevelBadges(userId, level, isPremium);
}
