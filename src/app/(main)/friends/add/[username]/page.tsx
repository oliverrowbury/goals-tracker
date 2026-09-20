import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, formatMonthYear } from "@/lib/dates";
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
import { levelForXp } from "@/lib/xp";
import { ADMIN_EMAIL } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { OwnerBadge } from "@/components/OwnerBadge";
import { UsersIcon, JournalIcon, ClockIcon, DumbbellIcon, FlameIcon } from "@/components/Icons";
import { FocusTagPills } from "../../FocusTagPills";
import { ActivityCard, type ActivityCardItem } from "../../ActivityCard";
import { BlockButton } from "../../BlockButton";
import { ReportButton } from "../../ReportButton";
import { requestFollowVoid, removeFollowByTarget } from "../../actions";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await getCurrentUser();
  const target = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!target) notFound();

  const isSelf = target.id === user.id;

  const [outgoing, followerCount, followingCount, myBlockOfThem, theirBlockOfMe] = await Promise.all([
    isSelf
      ? null
      : prisma.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: target.id } } }),
    prisma.follow.count({ where: { followingId: target.id, status: "ACCEPTED" } }),
    prisma.follow.count({ where: { followerId: target.id, status: "ACCEPTED" } }),
    isSelf ? null : prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: target.id } } }),
    isSelf ? null : prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: target.id, blockedId: user.id } } }),
  ]);

  const isFollowing = outgoing?.status === "ACCEPTED" && !theirBlockOfMe;
  const today = todayISO();

  // Only computed once there's an ACCEPTED follow — same privacy boundary
  // as the main Friends page, just for one person instead of a whole list.
  const [journalDates, studyDates, workoutDates] = isFollowing
    ? await Promise.all([
        target.shareJournalStreak
          ? prisma.journalEntry.findMany({ where: { userId: target.id, bodyText: { not: "" } }, select: { date: true } })
          : null,
        target.shareStudyStreak
          ? prisma.studySession.findMany({ where: { userId: target.id, durationMinutes: { not: null } }, select: { startedAt: true } })
          : null,
        target.shareWorkoutStreak
          ? prisma.workout.findMany({ where: { userId: target.id, endedAt: { not: null } }, select: { date: true } })
          : null,
      ])
    : [null, null, null];

  const journalStreak = journalDates && computeStreak(new Set(journalDates.map((e) => e.date.toISOString().slice(0, 10))), today);
  const studyStreak = studyDates && computeStreak(new Set(studyDates.map((s) => s.startedAt.toISOString().slice(0, 10))), today);
  const workoutStreak = workoutDates && computeStreak(new Set(workoutDates.map((w) => w.date.toISOString().slice(0, 10))), today);
  const hasAnyActivity = journalStreak != null || studyStreak != null || workoutStreak != null;

  // The person's own post history — not time-limited the way the main
  // Friends feed is (see friends/page.tsx's FEED_SINCE), so a post that's
  // aged off that feed after a week still lives here until the owner
  // archives it. Same privacy gate as the streaks above.
  const ACTIVITY_LIMIT = 30;
  const [profileWorkouts, profileStudySessions] = isFollowing
    ? await Promise.all([
        target.shareWorkoutStreak
          ? prisma.workout.findMany({
              where: { userId: target.id, endedAt: { not: null }, visibility: "FRIENDS", archived: false },
              orderBy: { endedAt: "desc" },
              take: ACTIVITY_LIMIT,
              include: { sets: { include: { exercise: true } } },
            })
          : [],
        target.shareStudyStreak
          ? prisma.studySession.findMany({
              where: { userId: target.id, endedAt: { not: null }, visibility: "FRIENDS", archived: false },
              orderBy: { endedAt: "desc" },
              take: ACTIVITY_LIMIT,
              include: { subject: true },
            })
          : [],
      ])
    : [[], []];

  const subjectIds = Array.from(new Set(profileStudySessions.map((s) => s.subjectId)));
  const subjectStreakSessions =
    subjectIds.length > 0
      ? await prisma.studySession.findMany({
          where: { userId: target.id, subjectId: { in: subjectIds }, durationMinutes: { not: null } },
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

  // Same PR history the feed and detail page use, scoped to this one owner.
  const strengthWorkouts = profileWorkouts.filter((w) => w.type !== "CARDIO");
  const oneRmHistorySets = strengthWorkouts.length > 0
    ? await prisma.workoutSet.findMany({
        where: { workout: { userId: target.id }, isWarmup: false },
        select: { weight: true, reps: true, exerciseId: true, workout: { select: { endedAt: true } } },
      })
    : [];
  const oneRmHistory = new Map<string, { endedAt: Date; oneRm: number }[]>();
  for (const s of oneRmHistorySets) {
    if (!s.workout.endedAt) continue;
    const key = `${target.id}:${s.exerciseId}`;
    if (!oneRmHistory.has(key)) oneRmHistory.set(key, []);
    oneRmHistory.get(key)!.push({ endedAt: s.workout.endedAt, oneRm: estimateOneRepMax(s.weight, s.reps) });
  }

  const cardioWorkouts = profileWorkouts.filter((w) => w.type === "CARDIO");
  const priorCardioWorkouts = cardioWorkouts.length > 0
    ? await prisma.workout.findMany({
        where: { userId: target.id, type: "CARDIO", endedAt: { not: null } },
        select: { endedAt: true, distanceKm: true, durationMinutes: true },
      })
    : [];

  type ActivityEntry = {
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

  const profileActivity: ActivityEntry[] = [
    ...profileWorkouts.map((w) => {
      const isCardio = w.type === "CARDIO";
      const rawStats = isCardio
        ? [
            { label: "Time", value: formatMinutes(w.durationMinutes ?? 0) },
            { label: "Distance", value: w.distanceKm ? formatDistance(w.distanceKm, user.distanceUnit) : "—" },
            { label: "Pace", value: formatPace(w.distanceKm, w.durationMinutes, user.distanceUnit) ?? "—" },
          ]
        : [
            { label: "Exercises", value: String(new Set(w.sets.map((s) => s.exerciseId)).size) },
            { label: "Sets", value: String(w.sets.filter((s) => !s.isWarmup).length) },
            { label: "Volume", value: formatWeight(computeVolume(w.sets), user.weightUnit) },
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
        exercises: isCardio ? undefined : annotateExercisePRs(groupSetsByExercise(w.sets), oneRmHistory, target.id, w.endedAt!),
        note: w.note,
        photoUrl: w.photoUrl,
      };
    }),
    ...profileStudySessions.map((s) => {
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
    .slice(0, ACTIVITY_LIMIT);

  const activityWorkoutIds = profileWorkouts.map((w) => w.id);
  const activityStudySessionIds = profileStudySessions.map((s) => s.id);
  const [likesGivenByMe, likeCounts, activityComments] =
    profileActivity.length > 0
      ? await Promise.all([
          prisma.cheer.findMany({
            where: { fromUserId: user.id, OR: [{ workoutId: { in: activityWorkoutIds } }, { studySessionId: { in: activityStudySessionIds } }] },
          }),
          prisma.cheer.findMany({
            where: { OR: [{ workoutId: { in: activityWorkoutIds } }, { studySessionId: { in: activityStudySessionIds } }] },
          }),
          prisma.comment.findMany({
            where: { OR: [{ workoutId: { in: activityWorkoutIds } }, { studySessionId: { in: activityStudySessionIds } }] },
            select: { workoutId: true, studySessionId: true },
          }),
        ])
      : [[], [], []];
  const likedByMeSet = new Set(likesGivenByMe.map((c) => c.workoutId ?? c.studySessionId));
  const likeCountMap = new Map<string, number>();
  for (const c of likeCounts) {
    const key = c.workoutId ?? c.studySessionId!;
    likeCountMap.set(key, (likeCountMap.get(key) ?? 0) + 1);
  }
  const commentCountMap = new Map<string, number>();
  for (const c of activityComments) {
    const key = c.workoutId ?? c.studySessionId!;
    commentCountMap.set(key, (commentCountMap.get(key) ?? 0) + 1);
  }

  const { level } = levelForXp(target.xp);

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Avatar name={target.name} avatarUrl={target.avatarUrl} size={72} />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <h1 className="font-serif text-xl font-semibold text-ink">{target.name}</h1>
            {target.email === ADMIN_EMAIL && <OwnerBadge />}
            <span className="rounded-full bg-calm-soft px-2.5 py-0.5 text-xs font-medium text-calm">Lv {level}</span>
          </div>
          <p className="text-sm text-ink-muted">
            @{target.username}
            {target.pronouns && <span> · {target.pronouns}</span>}
            {target.city && <span> · {target.city}</span>}
          </p>
          {target.bio && <p className="mt-2 text-sm text-ink">{target.bio}</p>}
          <p className="mt-1.5 text-xs text-ink-muted">Joined {formatMonthYear(target.createdAt)}</p>
        </div>

        {target.focusTags.length > 0 && (
          <div className="mt-3 flex justify-center">
            <FocusTagPills tags={target.focusTags} />
          </div>
        )}

        <div className="mt-4 flex justify-center gap-5 border-t border-line pt-4 text-sm">
          {isSelf || isFollowing ? (
            <>
              <Link href={`/friends/${target.username}/following`} className="hover:opacity-70">
                <span className="font-serif text-base font-semibold text-ink">{followingCount}</span>{" "}
                <span className="text-ink-muted">following</span>
              </Link>
              <Link href={`/friends/${target.username}/followers`} className="hover:opacity-70">
                <span className="font-serif text-base font-semibold text-ink">{followerCount}</span>{" "}
                <span className="text-ink-muted">followers</span>
              </Link>
            </>
          ) : (
            <>
              <span>
                <span className="font-serif text-base font-semibold text-ink">{followingCount}</span>{" "}
                <span className="text-ink-muted">following</span>
              </span>
              <span>
                <span className="font-serif text-base font-semibold text-ink">{followerCount}</span>{" "}
                <span className="text-ink-muted">followers</span>
              </span>
            </>
          )}
        </div>

        <div className="mt-4 border-t border-line pt-4">
          {isSelf ? (
            <p className="text-center text-sm text-ink-muted">This is your own profile — share your link instead.</p>
          ) : theirBlockOfMe ? (
            <p className="text-center text-sm text-ink-muted">This profile isn&apos;t available.</p>
          ) : myBlockOfThem ? (
            <div className="text-center">
              <p className="mb-2 text-sm text-ink-muted">You&apos;ve blocked this account.</p>
              <BlockButton targetUserId={target.id} targetName={target.name} blocked />
            </div>
          ) : isFollowing ? (
            <form action={removeFollowByTarget.bind(null, target.id)} className="text-center">
              <p className="mb-2 text-sm text-calm">You&apos;re following {target.name}.</p>
              <button type="submit" className="text-sm text-ink-muted hover:text-accent">
                Unfollow
              </button>
            </form>
          ) : outgoing ? (
            <form action={removeFollowByTarget.bind(null, target.id)} className="text-center">
              <p className="mb-2 text-sm text-ink-muted">Request sent — waiting for {target.name} to accept.</p>
              <button type="submit" className="text-sm text-ink-muted hover:text-accent">
                Cancel request
              </button>
            </form>
          ) : (
            <form action={requestFollowVoid.bind(null, target.id)} className="text-center">
              <button type="submit" className="rounded-lg bg-calm px-5 py-2 text-sm font-medium text-white hover:opacity-90">
                Follow
              </button>
            </form>
          )}
        </div>

        {!isSelf && !theirBlockOfMe && !myBlockOfThem && (
          <div className="mt-4 flex items-center justify-center gap-4 border-t border-line pt-4">
            <BlockButton targetUserId={target.id} targetName={target.name} blocked={false} />
            <ReportButton targetType="USER" targetUserId={target.id} />
          </div>
        )}

        {isFollowing && (
          <div className="mt-4 border-t border-line pt-4">
            {hasAnyActivity ? (
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                {journalStreak != null && (
                  <span className="flex items-center gap-1.5 text-ink-muted">
                    <JournalIcon className="h-4 w-4 text-accent" />
                    {journalStreak} day{journalStreak === 1 ? "" : "s"}
                  </span>
                )}
                {studyStreak != null && (
                  <span className="flex items-center gap-1.5 text-ink-muted">
                    <ClockIcon className="h-4 w-4 text-study" />
                    {studyStreak} day{studyStreak === 1 ? "" : "s"}
                  </span>
                )}
                {workoutStreak != null && (
                  <span className="flex items-center gap-1.5 text-ink-muted">
                    <DumbbellIcon className="h-4 w-4 text-workout" />
                    {workoutStreak} day{workoutStreak === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            ) : (
              <p className="flex items-center justify-center gap-1.5 text-xs text-ink-muted">
                <FlameIcon className="h-3.5 w-3.5" />
                Activity is private
              </p>
            )}
          </div>
        )}
      </div>

      {isFollowing && hasAnyActivity && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-ink-muted">Activity</h2>
          {profileActivity.length === 0 ? (
            <EmptyState message={`Nothing from ${target.name} yet.`} />
          ) : (
            <ul className="space-y-3">
              {profileActivity.map((item) => {
                const cardItem: ActivityCardItem = {
                  id: item.id,
                  kind: item.kind,
                  ownerId: target.id,
                  ownerName: target.name,
                  ownerUsername: target.username,
                  ownerAvatarUrl: target.avatarUrl,
                  when: item.when,
                  title: item.title,
                  note: item.note,
                  photoUrl: item.photoUrl,
                  stats: item.stats,
                  exercises: item.exercises,
                  subjectColor: item.subjectColor,
                  weightUnit: user.weightUnit,
                  likeCount: likeCountMap.get(item.id) ?? 0,
                  likedByMe: likedByMeSet.has(item.id),
                  commentCount: commentCountMap.get(item.id) ?? 0,
                  archived: false,
                };
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <ActivityCard item={cardItem} currentUserId={user.id} showOwner={false} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <Link href="/friends" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-ink-muted hover:text-calm">
        <UsersIcon className="h-4 w-4" />
        Back to friends
      </Link>
    </div>
  );
}
