import { prisma } from "@/lib/prisma";
import type { Badge } from "@/generated/prisma/enums";

// A fixed, curated set of milestones — same reasoning as the old
// accent-theme presets used to have: each one means something specific
// rather than being derived from a formula that could quietly change.
export const BADGE_INFO: Record<Badge, { emoji: string; label: string; description: string }> = {
  FIRST_JOURNAL_ENTRY: { emoji: "📝", label: "First entry", description: "Wrote your first journal entry" },
  FIRST_STUDY_SESSION: { emoji: "⏱️", label: "First session", description: "Logged your first study session" },
  FIRST_WORKOUT: { emoji: "💪", label: "First workout", description: "Finished your first workout" },
  FIRST_GOAL_COMPLETE: { emoji: "🎯", label: "First goal", description: "Completed a goal for the first time" },
  FIRST_DEADLINE_COMPLETE: { emoji: "⏰", label: "Beat a deadline", description: "Finished something before it was due" },
  JOURNAL_STREAK_7: { emoji: "🔥", label: "Week of writing", description: "7-day journal streak" },
  JOURNAL_STREAK_30: { emoji: "🏆", label: "Month of writing", description: "30-day journal streak" },
  STUDY_STREAK_7: { emoji: "📚", label: "Week of study", description: "7-day study streak" },
  WORKOUT_STREAK_7: { emoji: "🏋️", label: "Week of training", description: "7-day workout streak" },
  LEVEL_5: { emoji: "⭐", label: "Level 5", description: "Reached level 5" },
  LEVEL_10: { emoji: "🌟", label: "Level 10", description: "Reached level 10" },
};

// Idempotent — relies on the @@unique([userId, badge]) constraint, so
// callers can just call this every time the underlying condition is true
// without first checking whether it was already earned.
export async function awardBadge(userId: string, badge: Badge) {
  try {
    await prisma.userBadge.create({ data: { userId, badge } });
  } catch {
    // Already earned — the unique constraint caught it.
  }
}

export async function awardStreakBadges(userId: string, kind: "JOURNAL" | "STUDY" | "WORKOUT", streak: number) {
  if (kind === "JOURNAL") {
    if (streak >= 7) await awardBadge(userId, "JOURNAL_STREAK_7");
    if (streak >= 30) await awardBadge(userId, "JOURNAL_STREAK_30");
  } else if (kind === "STUDY" && streak >= 7) {
    await awardBadge(userId, "STUDY_STREAK_7");
  } else if (kind === "WORKOUT" && streak >= 7) {
    await awardBadge(userId, "WORKOUT_STREAK_7");
  }
}

export async function awardLevelBadges(userId: string, level: number) {
  if (level >= 5) await awardBadge(userId, "LEVEL_5");
  if (level >= 10) await awardBadge(userId, "LEVEL_10");
}
