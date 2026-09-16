import { prisma } from "@/lib/prisma";
import { computeStreak } from "@/lib/streaks";

export type FollowedUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  shareJournalStreak: boolean;
  shareStudyStreak: boolean;
  shareWorkoutStreak: boolean;
  xp: number;
};

// Per-category opt-in streaks for one followed person — shared by the main
// Friends page and the /friends/[username]/following list, since both show
// the same "who you follow, and their streaks" content, just at different
// scopes (yourself vs. anyone whose following list you can see).
export async function followedActivity(other: FollowedUser, today: string) {
  const [journalDates, studyDates, workoutDates] = await Promise.all([
    other.shareJournalStreak
      ? prisma.journalEntry.findMany({ where: { userId: other.id, bodyText: { not: "" } }, select: { date: true } })
      : null,
    other.shareStudyStreak
      ? prisma.studySession.findMany({
          where: { userId: other.id, durationMinutes: { not: null } },
          select: { startedAt: true },
        })
      : null,
    other.shareWorkoutStreak
      ? prisma.workout.findMany({ where: { userId: other.id, endedAt: { not: null } }, select: { date: true } })
      : null,
  ]);
  return {
    journalStreak: journalDates && computeStreak(new Set(journalDates.map((e) => e.date.toISOString().slice(0, 10))), today),
    studyStreak: studyDates && computeStreak(new Set(studyDates.map((s) => s.startedAt.toISOString().slice(0, 10))), today),
    workoutStreak: workoutDates && computeStreak(new Set(workoutDates.map((w) => w.date.toISOString().slice(0, 10))), today),
  };
}

// Messaging's permission bar is stricter than Follow's own one-directional
// model — both sides have to have an accepted follow on the other, not just
// one. Shared by the messages pages (access control) and the send action
// (defense in depth) so the rule only lives in one place.
export async function isMutualFollow(aId: string, bId: string): Promise<boolean> {
  const [aFollowsB, bFollowsA] = await Promise.all([
    prisma.follow.findFirst({ where: { followerId: aId, followingId: bId, status: "ACCEPTED" } }),
    prisma.follow.findFirst({ where: { followerId: bId, followingId: aId, status: "ACCEPTED" } }),
  ]);
  return !!aFollowsB && !!bFollowsA;
}
