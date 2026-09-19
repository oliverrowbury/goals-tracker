import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO } from "@/lib/dates";
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
} from "@/lib/workout";
import { ActivityCard, type ActivityCardItem } from "../../../ActivityCard";
import { CommentSection } from "../../../CommentSection";
import type { CommentDTO } from "../../../actions";

export const dynamic = "force-dynamic";

async function fetchComments(kind: "workout" | "study", id: string): Promise<CommentDTO[]> {
  const comments = await prisma.comment.findMany({
    where: kind === "workout" ? { workoutId: id } : { studySessionId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true, username: true, avatarUrl: true } } },
  });
  return comments.map((c) => ({
    id: c.id,
    authorId: c.authorId,
    authorName: c.author.name,
    authorUsername: c.author.username,
    authorAvatarUrl: c.author.avatarUrl,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  }));
}

// The feed's Instagram-style "tap a post" destination — same ActivityCard
// the feed and each profile's activity list use, plus the full comment
// thread below it. Same privacy boundary as friends/page.tsx's feed query,
// re-checked here rather than trusted from whichever link got us here.
export default async function PostDetailPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind !== "workout" && kind !== "study") notFound();

  const viewer = await getCurrentUser();

  if (kind === "workout") {
    const workout = await prisma.workout.findUnique({
      where: { id },
      include: { user: true, sets: { include: { exercise: true } } },
    });
    if (!workout || !workout.endedAt) notFound();

    if (workout.userId !== viewer.id) {
      const viewerFollowsOwner = await prisma.follow.findFirst({
        where: { followerId: viewer.id, followingId: workout.userId, status: "ACCEPTED" },
      });
      if (workout.visibility !== "FRIENDS" || !workout.user.shareWorkoutStreak || !viewerFollowsOwner) redirect("/friends");
    }

    const [likeCount, likedByMe, comments] = await Promise.all([
      prisma.cheer.count({ where: { workoutId: id } }),
      prisma.cheer.findFirst({ where: { fromUserId: viewer.id, workoutId: id } }),
      fetchComments("workout", id),
    ]);

    const isCardio = workout.type === "CARDIO";
    const rawStats = isCardio
      ? [
          { label: "Time", value: formatMinutes(workout.durationMinutes ?? 0) },
          { label: "Distance", value: workout.distanceKm ? formatDistance(workout.distanceKm, viewer.distanceUnit) : "—" },
          { label: "Pace", value: formatPace(workout.distanceKm, workout.durationMinutes, viewer.distanceUnit) ?? "—" },
        ]
      : [
          { label: "Exercises", value: String(new Set(workout.sets.map((s) => s.exerciseId)).size) },
          { label: "Sets", value: String(workout.sets.filter((s) => !s.isWarmup).length) },
          { label: "Volume", value: formatWeight(computeVolume(workout.sets), viewer.weightUnit) },
        ];

    // Same PR check the feed and profile activity list use — this owner's
    // full history, filtered to before this workout, so tapping into an
    // old post doesn't retroactively show a PR a later workout already beat.
    let stats = rawStats;
    let exercises: ExerciseBreakdown[] | undefined = isCardio ? undefined : groupSetsByExercise(workout.sets);
    if (isCardio) {
      const priorCardio = await prisma.workout.findMany({
        where: { userId: workout.userId, type: "CARDIO", endedAt: { lt: workout.endedAt, not: null } },
        select: { distanceKm: true, durationMinutes: true },
      });
      stats = annotateCardioPRs(rawStats, { distanceKm: workout.distanceKm, durationMinutes: workout.durationMinutes }, priorCardio);
    } else if (exercises && exercises.length > 0) {
      const priorSets = await prisma.workoutSet.findMany({
        where: { workout: { userId: workout.userId, endedAt: { lt: workout.endedAt } }, isWarmup: false },
        select: { weight: true, reps: true, exerciseId: true, workout: { select: { endedAt: true } } },
      });
      const history = new Map<string, { endedAt: Date; oneRm: number }[]>();
      for (const s of priorSets) {
        const key = `${workout.userId}:${s.exerciseId}`;
        if (!history.has(key)) history.set(key, []);
        history.get(key)!.push({ endedAt: s.workout.endedAt!, oneRm: estimateOneRepMax(s.weight, s.reps) });
      }
      exercises = annotateExercisePRs(exercises, history, workout.userId, workout.endedAt);
    }

    const cardItem: ActivityCardItem = {
      id,
      kind: "workout",
      ownerId: workout.userId,
      ownerName: workout.user.name,
      ownerUsername: workout.user.username,
      ownerAvatarUrl: workout.user.avatarUrl,
      when: workout.endedAt,
      title: workout.label,
      note: workout.note,
      photoUrl: workout.photoUrl,
      stats,
      exercises,
      weightUnit: viewer.weightUnit,
      likeCount,
      likedByMe: !!likedByMe,
      commentCount: comments.length,
      archived: workout.archived,
    };

    return (
      <div className="mx-auto max-w-md">
        <Link href="/friends" className="mb-4 inline-block text-sm text-ink-muted hover:text-calm">
          ← Back to friends
        </Link>
        <ActivityCard item={cardItem} currentUserId={viewer.id} linkToDetail={false}>
          <CommentSection kind="workout" activityId={id} currentUserId={viewer.id} postOwnerId={workout.userId} initialComments={comments} />
        </ActivityCard>
      </div>
    );
  }

  const session = await prisma.studySession.findUnique({ where: { id }, include: { user: true, subject: true } });
  if (!session || !session.endedAt) notFound();

  if (session.userId !== viewer.id) {
    const viewerFollowsOwner = await prisma.follow.findFirst({
      where: { followerId: viewer.id, followingId: session.userId, status: "ACCEPTED" },
    });
    if (session.visibility !== "FRIENDS" || !session.user.shareStudyStreak || !viewerFollowsOwner) redirect("/friends");
  }

  const [likeCount, likedByMe, comments, subjectSessions] = await Promise.all([
    prisma.cheer.count({ where: { studySessionId: id } }),
    prisma.cheer.findFirst({ where: { fromUserId: viewer.id, studySessionId: id } }),
    fetchComments("study", id),
    // For the subject's current streak alongside this session's own time —
    // one bare number ("47m") didn't say anything about whether this was
    // part of a run or a one-off.
    prisma.studySession.findMany({
      where: { userId: session.userId, subjectId: session.subjectId, durationMinutes: { not: null } },
      select: { startedAt: true },
    }),
  ]);

  const subjectStreak = computeStreak(
    new Set(subjectSessions.map((s) => s.startedAt.toISOString().slice(0, 10))),
    todayISO(),
  );

  const cardItem: ActivityCardItem = {
    id,
    kind: "study",
    ownerId: session.userId,
    ownerName: session.user.name,
    ownerUsername: session.user.username,
    ownerAvatarUrl: session.user.avatarUrl,
    when: session.endedAt,
    title: session.subject.name,
    subjectColor: session.subject.color,
    note: session.note,
    stats: [
      { label: "Time studied", value: formatMinutes(session.durationMinutes ?? 0) },
      ...(subjectStreak > 0 ? [{ label: "Streak", value: `${subjectStreak} day${subjectStreak === 1 ? "" : "s"}` }] : []),
    ],
    likeCount,
    likedByMe: !!likedByMe,
    commentCount: comments.length,
    archived: session.archived,
  };

  return (
    <div className="mx-auto max-w-md">
      <Link href="/friends" className="mb-4 inline-block text-sm text-ink-muted hover:text-calm">
        ← Back to friends
      </Link>
      <ActivityCard item={cardItem} currentUserId={viewer.id} linkToDetail={false}>
        <CommentSection kind="study" activityId={id} currentUserId={viewer.id} postOwnerId={session.userId} initialComments={comments} />
      </ActivityCard>
    </div>
  );
}
