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

// Clamped at 0 so an undo (e.g. un-ticking a goal) can't push a user
// negative — see toggleGoalCompletion, the only caller that ever passes a
// negative amount.
export async function awardXp(userId: string, amount: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } });
  const xp = Math.max(0, user.xp + amount);
  await prisma.user.update({ where: { id: userId }, data: { xp } });

  const { level } = levelForXp(xp);
  await awardLevelBadges(userId, level);
}
