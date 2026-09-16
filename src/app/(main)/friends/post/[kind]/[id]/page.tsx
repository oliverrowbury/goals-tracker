import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { weekdayShortDayMonth } from "@/lib/dates";
import { formatMinutes } from "@/lib/study";
import { formatDistance, formatPace, formatWeight, computeVolume } from "@/lib/workout";
import { Avatar } from "@/components/Avatar";
import { ActivityIcon, ClockIcon } from "@/components/Icons";
import { LikeButton } from "../../../LikeButton";

export const dynamic = "force-dynamic";

// The card wrapper both branches below share — owner row, photo slot,
// title, a caller-supplied stats grid, and the like button. Split out so
// the two very differently-shaped Prisma results (Workout vs StudySession)
// each get their own properly-typed branch instead of one shared type
// TypeScript can't narrow between.
function PostCard({
  ownerName,
  ownerUsername,
  ownerAvatarUrl,
  dateISO,
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
}: {
  ownerName: string;
  ownerUsername: string;
  ownerAvatarUrl: string | null;
  dateISO: string;
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
              <p className="text-xs text-ink-muted">{weekdayShortDayMonth(dateISO)}</p>
            </div>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${badgeClass}`}>{icon}</span>
          </div>

          <h1 className="mt-4 font-serif text-xl font-semibold text-ink">{title}</h1>
          {note && <p className="mt-1.5 text-sm text-ink">{note}</p>}

          <div className={`mt-4 grid gap-3 border-t border-line pt-4 text-sm ${stats.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-serif text-lg font-semibold text-ink">{s.value}</p>
                <p className="text-xs text-ink-muted">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <LikeButton kind={kind} activityId={id} count={likeCount} likedByMe={likedByMe} />
          </div>
        </div>
      </div>
    </div>
  );
}

// The feed's Instagram-style "tap a post" destination — photo first (when
// there is one) like an Insta post, everything else (who/when/stats/
// caption/likes) below it. Deliberately exposes no more than the feed
// itself already does (summary stats, not a full per-set breakdown) —
// same privacy boundary as friends/page.tsx's feed query, re-checked here
// rather than trusted from whichever link got us here.
export default async function PostDetailPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind !== "workout" && kind !== "study") notFound();

  const viewer = await getCurrentUser();

  if (kind === "workout") {
    const workout = await prisma.workout.findUnique({ where: { id }, include: { user: true, sets: true } });
    if (!workout || !workout.endedAt) notFound();

    if (workout.userId !== viewer.id) {
      const viewerFollowsOwner = await prisma.follow.findFirst({
        where: { followerId: viewer.id, followingId: workout.userId, status: "ACCEPTED" },
      });
      if (workout.visibility !== "FRIENDS" || !workout.user.shareWorkoutStreak || !viewerFollowsOwner) redirect("/friends");
    }

    const [likeCount, likedByMe] = await Promise.all([
      prisma.cheer.count({ where: { workoutId: id } }),
      prisma.cheer.findFirst({ where: { fromUserId: viewer.id, workoutId: id } }),
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

    return (
      <PostCard
        ownerName={workout.user.name}
        ownerUsername={workout.user.username}
        ownerAvatarUrl={workout.user.avatarUrl}
        dateISO={workout.endedAt.toISOString().slice(0, 10)}
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

  const [likeCount, likedByMe] = await Promise.all([
    prisma.cheer.count({ where: { studySessionId: id } }),
    prisma.cheer.findFirst({ where: { fromUserId: viewer.id, studySessionId: id } }),
  ]);

  return (
    <PostCard
      ownerName={session.user.name}
      ownerUsername={session.user.username}
      ownerAvatarUrl={session.user.avatarUrl}
      dateISO={session.endedAt.toISOString().slice(0, 10)}
      badgeClass="bg-study-soft text-study"
      icon={<ClockIcon className="h-4 w-4" />}
      title={session.subject.name}
      note={session.note}
      stats={[{ label: "Time studied", value: formatMinutes(session.durationMinutes ?? 0) }]}
      kind="study"
      id={id}
      likeCount={likeCount}
      likedByMe={!!likedByMe}
    />
  );
}
