import { prisma } from "@/lib/prisma";
import type { Badge } from "@/generated/prisma/enums";

// Display data (emoji/label/description) lives in lib/badgeInfo.ts, which
// has no server-only imports — re-exported here so existing server-side
// callers of `@/lib/badges` don't need to change their import path.
export { BADGE_INFO } from "@/lib/badgeInfo";

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
    if (streak >= 100) await awardBadge(userId, "JOURNAL_STREAK_100");
  } else if (kind === "STUDY") {
    if (streak >= 7) await awardBadge(userId, "STUDY_STREAK_7");
    if (streak >= 30) await awardBadge(userId, "STUDY_STREAK_30");
  } else if (kind === "WORKOUT") {
    if (streak >= 7) await awardBadge(userId, "WORKOUT_STREAK_7");
    if (streak >= 30) await awardBadge(userId, "WORKOUT_STREAK_30");
  }
}

export async function awardLevelBadges(userId: string, level: number) {
  if (level >= 5) await awardBadge(userId, "LEVEL_5");
  if (level >= 10) await awardBadge(userId, "LEVEL_10");
  if (level >= 20) await awardBadge(userId, "LEVEL_20");
  if (level >= 50) await awardBadge(userId, "LEVEL_50");
}

export async function awardWorkoutCountBadges(userId: string, totalFinishedWorkouts: number) {
  if (totalFinishedWorkouts >= 10) await awardBadge(userId, "TOTAL_WORKOUTS_10");
  if (totalFinishedWorkouts >= 50) await awardBadge(userId, "TOTAL_WORKOUTS_50");
  if (totalFinishedWorkouts >= 100) await awardBadge(userId, "TOTAL_WORKOUTS_100");
}

export async function awardStudyHoursBadges(userId: string, totalStudyMinutes: number) {
  const hours = totalStudyMinutes / 60;
  if (hours >= 10) await awardBadge(userId, "TOTAL_STUDY_HOURS_10");
  if (hours >= 50) await awardBadge(userId, "TOTAL_STUDY_HOURS_50");
}

// Server-time-of-day badges — same UTC-as-calendar-day convention the rest
// of the app uses (see lib/dates.ts), not a per-user local time, so these
// are an approximation for anyone outside UTC rather than exact.
export async function awardTimeOfDayBadges(userId: string, at: Date) {
  const hour = at.getUTCHours();
  if (hour < 7) await awardBadge(userId, "EARLY_BIRD");
  if (hour >= 22) await awardBadge(userId, "NIGHT_OWL");
}
