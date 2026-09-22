import { prisma } from "@/lib/prisma";
import { computeStreak } from "@/lib/streaks";
import { formatMinutes } from "@/lib/study";
import {
  formatDistance,
  formatPace,
  formatWeight,
  computeVolume,
  groupSetsByExercise,
  annotateExercisePRs,
  annotateCardioPRs,
  estimateOneRepMax,
  type ExerciseBreakdown,
  type Stat,
} from "@/lib/workout";
import type { WeightUnit, DistanceUnit } from "@/lib/constants";

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

export type OwnActivityEntry = {
  id: string;
  kind: "workout" | "study";
  when: Date;
  title: string;
  stats: Stat[];
  exercises?: ExerciseBreakdown[];
  subjectColor?: string;
  note?: string | null;
  photoUrl?: string | null;
};

const OWN_ACTIVITY_LIMIT = 30;

// Your own post history and streaks, unfiltered by the shareXStreak
// switches or post visibility — those gate what a FRIEND sees, not what
// you see looking at yourself. Shared by the main Friends page's own
// profile card and the dedicated /friends/add/[username] profile page (for
// isSelf there) so this PR/streak-annotation logic — identical in both —
// only lives in one place.
export async function ownActivity(userId: string, weightUnit: WeightUnit, distanceUnit: DistanceUnit, today: string) {
  const [journalDates, studyDates, workoutDates] = await Promise.all([
    prisma.journalEntry.findMany({ where: { userId, bodyText: { not: "" } }, select: { date: true } }),
    prisma.studySession.findMany({ where: { userId, durationMinutes: { not: null } }, select: { startedAt: true } }),
    prisma.workout.findMany({ where: { userId, endedAt: { not: null } }, select: { date: true } }),
  ]);
  const journalStreak = computeStreak(new Set(journalDates.map((e) => e.date.toISOString().slice(0, 10))), today);
  const studyStreak = computeStreak(new Set(studyDates.map((s) => s.startedAt.toISOString().slice(0, 10))), today);
  const workoutStreak = computeStreak(new Set(workoutDates.map((w) => w.date.toISOString().slice(0, 10))), today);

  const [workouts, studySessions] = await Promise.all([
    prisma.workout.findMany({
      where: { userId, endedAt: { not: null }, archived: false },
      orderBy: { endedAt: "desc" },
      take: OWN_ACTIVITY_LIMIT,
      include: { sets: { include: { exercise: true } } },
    }),
    prisma.studySession.findMany({
      where: { userId, endedAt: { not: null }, archived: false },
      orderBy: { endedAt: "desc" },
      take: OWN_ACTIVITY_LIMIT,
      include: { subject: true },
    }),
  ]);

  const subjectIds = Array.from(new Set(studySessions.map((s) => s.subjectId)));
  const subjectStreakSessions =
    subjectIds.length > 0
      ? await prisma.studySession.findMany({
          where: { userId, subjectId: { in: subjectIds }, durationMinutes: { not: null } },
          select: { subjectId: true, startedAt: true },
        })
      : [];
  const datesBySubject = new Map<string, Set<string>>();
  for (const s of subjectStreakSessions) {
    if (!datesBySubject.has(s.subjectId)) datesBySubject.set(s.subjectId, new Set());
    datesBySubject.get(s.subjectId)!.add(s.startedAt.toISOString().slice(0, 10));
  }
  const streakBySubject = new Map<string, number>();
  for (const [subjectId, dates] of datesBySubject) streakBySubject.set(subjectId, computeStreak(dates, today));

  const strengthWorkouts = workouts.filter((w) => w.type !== "CARDIO");
  const oneRmHistorySets = strengthWorkouts.length > 0
    ? await prisma.workoutSet.findMany({
        where: { workout: { userId }, isWarmup: false },
        select: { weight: true, reps: true, exerciseId: true, workout: { select: { endedAt: true } } },
      })
    : [];
  const oneRmHistory = new Map<string, { endedAt: Date; oneRm: number }[]>();
  for (const s of oneRmHistorySets) {
    if (!s.workout.endedAt) continue;
    const key = `${userId}:${s.exerciseId}`;
    if (!oneRmHistory.has(key)) oneRmHistory.set(key, []);
    oneRmHistory.get(key)!.push({ endedAt: s.workout.endedAt, oneRm: estimateOneRepMax(s.weight, s.reps) });
  }

  const cardioWorkouts = workouts.filter((w) => w.type === "CARDIO");
  const priorCardioWorkouts = cardioWorkouts.length > 0
    ? await prisma.workout.findMany({
        where: { userId, type: "CARDIO", endedAt: { not: null } },
        select: { endedAt: true, distanceKm: true, durationMinutes: true },
      })
    : [];

  const entries: OwnActivityEntry[] = [
    ...workouts.map((w) => {
      const isCardio = w.type === "CARDIO";
      const rawStats = isCardio
        ? [
            { label: "Time", value: formatMinutes(w.durationMinutes ?? 0) },
            { label: "Distance", value: w.distanceKm ? formatDistance(w.distanceKm, distanceUnit) : "—" },
            { label: "Pace", value: formatPace(w.distanceKm, w.durationMinutes, distanceUnit) ?? "—" },
          ]
        : [
            { label: "Exercises", value: String(new Set(w.sets.map((s) => s.exerciseId)).size) },
            { label: "Sets", value: String(w.sets.filter((s) => !s.isWarmup).length) },
            { label: "Volume", value: formatWeight(computeVolume(w.sets), weightUnit) },
          ];
      return {
        id: w.id,
        kind: "workout" as const,
        when: w.endedAt!,
        title: w.label,
        stats: isCardio
          ? annotateCardioPRs(
              rawStats,
              { distanceKm: w.distanceKm, durationMinutes: w.durationMinutes },
              priorCardioWorkouts.filter((p) => p.endedAt! < w.endedAt!),
            )
          : rawStats,
        exercises: isCardio ? undefined : annotateExercisePRs(groupSetsByExercise(w.sets), oneRmHistory, userId, w.endedAt!),
        note: w.note,
        photoUrl: w.photoUrl,
      };
    }),
    ...studySessions.map((s) => {
      const streak = streakBySubject.get(s.subjectId) ?? 0;
      return {
        id: s.id,
        kind: "study" as const,
        when: s.endedAt!,
        title: s.subject.name,
        subjectColor: s.subject.color,
        note: s.note,
        stats: [
          { label: "Time studied", value: formatMinutes(s.durationMinutes ?? 0) },
          ...(streak > 0 ? [{ label: "Streak", value: `${streak} day${streak === 1 ? "" : "s"}` }] : []),
        ],
      };
    }),
  ]
    .sort((a, b) => b.when.getTime() - a.when.getTime())
    .slice(0, OWN_ACTIVITY_LIMIT);

  return { journalStreak, studyStreak, workoutStreak, entries };
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

// Blocking is one-directional but checked both ways everywhere it matters
// (following, messaging, commenting) — if either person has blocked the
// other, neither side gets through, same as most social apps.
export async function isBlocked(aId: string, bId: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: { OR: [{ blockerId: aId, blockedId: bId }, { blockerId: bId, blockedId: aId }] },
  });
  return !!block;
}
