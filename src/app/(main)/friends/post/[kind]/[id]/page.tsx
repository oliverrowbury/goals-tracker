import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, relativeLabel } from "@/lib/dates";
import { computeStreak } from "@/lib/streaks";
import { formatMinutes } from "@/lib/study";
import { formatDistance, formatPace, formatWeight, computeVolume } from "@/lib/workout";
import { Avatar } from "@/components/Avatar";
import { ActivityIcon, ClockIcon, MessageIcon } from "@/components/Icons";
import { LikeButton } from "../../../LikeButton";
import { CommentSection } from "../../../CommentSection";
import type { CommentDTO } from "../../../actions";

type ExerciseBreakdown = { name: string; sets: { weight: number; reps: number; isWarmup: boolean }[] };

export const dynamic = "force-dynamic";

// The card wrapper both branches below share — owner row, photo slot,
// title, a caller-supplied stats grid, and the like button. Split out so
// the two very differently-shaped Prisma results (Workout vs StudySession)
// each get their own properly-typed branch instead of one shared type
// TypeScript can't narrow between.
function PostCard({
  ownerId,
  ownerName,
  ownerUsername,
  ownerAvatarUrl,
  when,
  photoUrl,
  badgeClass,
  icon,
  title,
  note,
  stats,
  kind,
  id,
  likeCount,
  likedByMe,
  currentUserId,
  comments,
  exercises,
  weightUnit,
}: {
  ownerId: string;
  ownerName: string;
  ownerUsername: string;
  ownerAvatarUrl: string | null;
  when: Date;
  photoUrl?: string | null;
  badgeClass: string;
  icon: React.ReactNode;
  title: string;
  note?: string | null;
  stats: { label: string; value: string }[];
  kind: "workout" | "study";
  id: string;
  likeCount: number;
  likedByMe: boolean;
  currentUserId: string;
  comments: CommentDTO[];
  exercises?: ExerciseBreakdown[];
  weightUnit?: "KG" | "LB";
}) {
  return (
    <div className="mx-auto max-w-md">
      <Link href="/friends" className="mb-4 inline-block text-sm text-ink-muted hover:text-calm">
        ← Back to friends
      </Link>

      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="aspect-square w-full object-cover" />
        )}

        <div className="p-5">
          <div className="flex items-center gap-3">
            <Link href={`/friends/add/${ownerUsername}`} className="shrink-0">
              <Avatar name={ownerName} avatarUrl={ownerAvatarUrl} size={40} />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/friends/add/${ownerUsername}`} className="font-medium text-ink hover:underline">
                {ownerName}
              </Link>
              <p className="text-xs text-ink-muted">
                @{ownerUsername} · {relativeLabel(when, todayISO())}
              </p>
            </div>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${badgeClass}`}>{icon}</span>
          </div>

          <h1 className="mt-4 font-serif text-xl font-semibold text-ink">{title}</h1>
          {note && <p className="mt-1.5 text-sm text-ink">{note}</p>}

          <div
            className={`mt-4 grid gap-3 border-t border-line pt-4 text-sm ${
              stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3"
            }`}
          >
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-serif text-lg font-semibold text-ink">{s.value}</p>
                <p className="text-xs text-ink-muted">{s.label}</p>
              </div>
            ))}
          </div>

          {/* The actual set-by-set work, not just the aggregate numbers
              above — the thing that made this workout what it was, and
              what a friend scrolling past would actually want to see
              (this is Hevy's whole feed). */}
          {exercises && exercises.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-line pt-4 text-left">
              {exercises.map((ex) => (
                <div key={ex.name}>
                  <p className="text-sm font-medium text-ink">{ex.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {ex.sets.map((s, i) => (
                      <span key={i}>
                        {i > 0 && ", "}
                        {formatWeight(s.weight, weightUnit ?? "KG")}×{s.reps}
                        {s.isWarmup && "w"}
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
            <LikeButton kind={kind} activityId={id} count={likeCount} likedByMe={likedByMe} />
            <a
              href="#comments"
              className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-calm hover:text-calm"
            >
              <MessageIcon className="h-4 w-4" />
              {comments.length > 0 && <span className="tabular-nums">{comments.length}</span>}
            </a>
          </div>

          <div id="comments" className="scroll-mt-6">
            <CommentSection
              kind={kind}
              activityId={id}
              currentUserId={currentUserId}
              postOwnerId={ownerId}
              initialComments={comments}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

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

// The feed's Instagram-style "tap a post" destination — photo first (when
// there is one) like an Insta post, everything else (who/when/stats/
// caption/likes) below it, plus the full per-exercise set breakdown for a
// strength workout (see ExerciseBreakdown) and a subject streak for a
// study session — the actual substance the feed's own summary line can
// only gesture at. Same privacy boundary as friends/page.tsx's feed
// query, re-checked here rather than trusted from whichever link got us
// here.
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
    const stats = isCardio
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

    // Grouped by exercise in first-seen order — same pattern as the
    // workout log's own expanded-set view (WorkoutTracker's HistoryWorkout).
    const exerciseOrder: string[] = [];
    const setsByExercise = new Map<string, ExerciseBreakdown["sets"]>();
    for (const s of workout.sets) {
      if (!setsByExercise.has(s.exercise.name)) {
        setsByExercise.set(s.exercise.name, []);
        exerciseOrder.push(s.exercise.name);
      }
      setsByExercise.get(s.exercise.name)!.push({ weight: s.weight, reps: s.reps, isWarmup: s.isWarmup });
    }
    const exercises: ExerciseBreakdown[] = exerciseOrder.map((name) => ({ name, sets: setsByExercise.get(name)! }));

    return (
      <PostCard
        ownerId={workout.userId}
        ownerName={workout.user.name}
        ownerUsername={workout.user.username}
        ownerAvatarUrl={workout.user.avatarUrl}
        when={workout.endedAt}
        photoUrl={workout.photoUrl}
        badgeClass="bg-workout-soft text-workout"
        icon={<ActivityIcon className="h-4 w-4" />}
        title={workout.label}
        note={workout.note}
        stats={stats}
        kind="workout"
        id={id}
        likeCount={likeCount}
        likedByMe={!!likedByMe}
        currentUserId={viewer.id}
        comments={comments}
        exercises={isCardio ? undefined : exercises}
        weightUnit={viewer.weightUnit}
      />
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

  return (
    <PostCard
      ownerId={session.userId}
      ownerName={session.user.name}
      ownerUsername={session.user.username}
      ownerAvatarUrl={session.user.avatarUrl}
      when={session.endedAt}
      badgeClass="bg-study-soft text-study"
      icon={<ClockIcon className="h-4 w-4" />}
      title={session.subject.name}
      note={session.note}
      stats={[
        { label: "Time studied", value: formatMinutes(session.durationMinutes ?? 0) },
        ...(subjectStreak > 0
          ? [{ label: "Streak", value: `${subjectStreak} day${subjectStreak === 1 ? "" : "s"}` }]
          : []),
      ]}
      kind="study"
      id={id}
      likeCount={likeCount}
      likedByMe={!!likedByMe}
      currentUserId={viewer.id}
      comments={comments}
    />
  );
}
