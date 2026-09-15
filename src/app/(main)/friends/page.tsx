import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, shiftISO, isoToDate, weekdayShortDayMonth } from "@/lib/dates";
import { computeStreak } from "@/lib/streaks";
import { levelForXp } from "@/lib/xp";
import { formatMinutes } from "@/lib/study";
import { formatDistance, formatPace } from "@/lib/workout";
import { Avatar } from "@/components/Avatar";
import { UsersIcon, FlameIcon, JournalIcon, ClockIcon, DumbbellIcon, ActivityIcon, TargetIcon } from "@/components/Icons";
import { AddFriendSearch } from "./AddFriendSearch";
import { ShareActivityToggle } from "./ShareActivityToggle";
import { UnfollowButton } from "./UnfollowButton";
import { LikeButton } from "./LikeButton";
import { CopyLinkButton } from "./CopyLinkButton";
import { followUserVoid } from "./actions";

export const dynamic = "force-dynamic";

type FollowedUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  shareJournalStreak: boolean;
  shareStudyStreak: boolean;
  shareWorkoutStreak: boolean;
  xp: number;
};

// The only place in the app that reads another user's rows — gated behind
// a follow (checked by the caller) and, per category, that user's own
// share*Streak opt-in, so it's never reachable just by knowing a user id.
// Journal *content* is never included here regardless — only whether an
// entry exists on a given day, the same way the streak is already computed
// for the signed-in user's own settings page. Each category is fetched
// independently so one person can show their workout streak without also
// showing their journal streak.
async function followedActivity(other: FollowedUser, today: string) {
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

// "Just now" / "2 hours ago" / "Yesterday" / "Sun 13 Sept" — same idea as
// the workout log and study session dayLabels, just with same-day
// hour-granularity like Strava/Hevy's feed instead of only "Today".
function relativeLabel(date: Date, today: string): string {
  const dateISO = date.toISOString().slice(0, 10);
  if (dateISO === today) {
    const hoursAgo = Math.floor((Date.now() - date.getTime()) / (60 * 60 * 1000));
    if (hoursAgo < 1) return "Just now";
    return `${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago`;
  }
  if (dateISO === shiftISO(today, -1)) return "Yesterday";
  return weekdayShortDayMonth(dateISO);
}

type FeedItem = {
  id: string;
  kind: "workout" | "study";
  userId: string;
  when: Date;
  title: string;
  detail: string;
  photoUrl?: string | null;
};

export default async function FriendsPage() {
  const user = await getCurrentUser();
  const today = todayISO();

  const [following, followers, journalCount, studySessionCount, workoutCount, goalsDoneCount] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: user.id },
      include: {
        following: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            shareJournalStreak: true,
            shareStudyStreak: true,
            shareWorkoutStreak: true,
            xp: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.follow.findMany({
      where: { followingId: user.id },
      include: { follower: { select: { id: true, name: true, username: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.journalEntry.count({ where: { userId: user.id, bodyText: { not: "" } } }),
    prisma.studySession.count({ where: { userId: user.id, durationMinutes: { not: null } } }),
    prisma.workout.count({ where: { userId: user.id, endedAt: { not: null } } }),
    prisma.goalLog.count({ where: { completed: true, goal: { userId: user.id } } }),
  ]);

  const followingList = following.map((f) => f.following);
  const followingIds = followingList.map((f) => f.id);
  const followingIdSet = new Set(followingIds);
  const followerIdSet = new Set(followers.map((f) => f.follower.id));

  const followedById = new Map(followingList.map((f) => [f.id, f]));
  const shareWorkoutIds = followingList.filter((o) => o.shareWorkoutStreak).map((o) => o.id);
  const shareStudyIds = followingList.filter((o) => o.shareStudyStreak).map((o) => o.id);

  // Last two weeks, most recent 25 — a live feed, not a full archive (each
  // person's own history already lives on their Study/Workout pages).
  const FEED_SINCE = isoToDate(shiftISO(today, -14));
  const FEED_LIMIT = 25;

  const [activityByUserId, feedWorkouts, feedStudySessions] = await Promise.all([
    (async () => {
      const map = new Map<string, Awaited<ReturnType<typeof followedActivity>>>();
      await Promise.all(
        followingList.map(async (other) => {
          if (!other.shareJournalStreak && !other.shareStudyStreak && !other.shareWorkoutStreak) return;
          map.set(other.id, await followedActivity(other, today));
        }),
      );
      return map;
    })(),
    shareWorkoutIds.length > 0
      ? prisma.workout.findMany({
          where: { userId: { in: shareWorkoutIds }, endedAt: { gte: FEED_SINCE }, visibility: "FRIENDS" },
          orderBy: { endedAt: "desc" },
          take: FEED_LIMIT,
        })
      : [],
    shareStudyIds.length > 0
      ? prisma.studySession.findMany({
          where: { userId: { in: shareStudyIds }, endedAt: { gte: FEED_SINCE }, visibility: "FRIENDS" },
          orderBy: { endedAt: "desc" },
          take: FEED_LIMIT,
          include: { subject: true },
        })
      : [],
  ]);

  const feed: FeedItem[] = [
    ...feedWorkouts.map((w) => ({
      id: w.id,
      kind: "workout" as const,
      userId: w.userId,
      when: w.endedAt!,
      title: w.label,
      detail:
        w.type === "CARDIO"
          ? [
              w.distanceKm ? formatDistance(w.distanceKm, user.distanceUnit) : null,
              formatMinutes(w.durationMinutes ?? 0),
              formatPace(w.distanceKm, w.durationMinutes, user.distanceUnit),
            ]
              .filter(Boolean)
              .join(" · ")
          : formatMinutes(w.durationMinutes ?? 0),
      photoUrl: w.photoUrl,
    })),
    ...feedStudySessions.map((s) => ({
      id: s.id,
      kind: "study" as const,
      userId: s.userId,
      when: s.endedAt!,
      title: s.subject.name,
      detail: formatMinutes(s.durationMinutes ?? 0),
    })),
  ]
    .sort((a, b) => b.when.getTime() - a.when.getTime())
    .slice(0, FEED_LIMIT);

  const workoutIds = feedWorkouts.map((w) => w.id);
  const studySessionIds = feedStudySessions.map((s) => s.id);
  const [likesGivenByMe, likeCounts] = await Promise.all([
    prisma.cheer.findMany({
      where: { fromUserId: user.id, OR: [{ workoutId: { in: workoutIds } }, { studySessionId: { in: studySessionIds } }] },
    }),
    prisma.cheer.findMany({
      where: { OR: [{ workoutId: { in: workoutIds } }, { studySessionId: { in: studySessionIds } }] },
    }),
  ]);
  const likedByMeSet = new Set(likesGivenByMe.map((c) => c.workoutId ?? c.studySessionId));
  const likeCountMap = new Map<string, number>();
  for (const c of likeCounts) {
    const key = c.workoutId ?? c.studySessionId!;
    likeCountMap.set(key, (likeCountMap.get(key) ?? 0) + 1);
  }

  const { level } = levelForXp(user.xp);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2.5">
        <UsersIcon className="h-5 w-5 shrink-0 text-calm" />
        <h1 className="font-serif text-2xl font-semibold text-ink">Friends</h1>
      </div>

      <section className="mb-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <Avatar name={user.name} avatarUrl={user.avatarUrl} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-lg font-semibold text-ink">{user.name}</h2>
              <span className="rounded-full bg-calm-soft px-2.5 py-0.5 text-xs font-medium text-calm">Lv {level}</span>
            </div>
            <p className="text-sm text-ink-muted">
              @{user.username}
              {user.pronouns && <span> · {user.pronouns}</span>}
              {user.city && <span> · {user.city}</span>}
            </p>
            {user.bio && <p className="mt-1.5 text-sm text-ink">{user.bio}</p>}
          </div>
        </div>

        <div className="mt-4 flex gap-5 border-t border-line pt-4 text-sm">
          <span>
            <span className="font-serif text-base font-semibold text-ink">{following.length}</span>{" "}
            <span className="text-ink-muted">following</span>
          </span>
          <span>
            <span className="font-serif text-base font-semibold text-ink">{followers.length}</span>{" "}
            <span className="text-ink-muted">followers</span>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div className="flex items-center gap-2">
            <JournalIcon className="h-5 w-5 shrink-0 text-accent" />
            <div>
              <p className="font-serif text-base font-semibold text-ink">{journalCount}</p>
              <p className="text-xs text-ink-muted">journals</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5 shrink-0 text-study" />
            <div>
              <p className="font-serif text-base font-semibold text-ink">{studySessionCount}</p>
              <p className="text-xs text-ink-muted">study sessions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DumbbellIcon className="h-5 w-5 shrink-0 text-workout" />
            <div>
              <p className="font-serif text-base font-semibold text-ink">{workoutCount}</p>
              <p className="text-xs text-ink-muted">workouts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TargetIcon className="h-5 w-5 shrink-0 text-goals" />
            <div>
              <p className="font-serif text-base font-semibold text-ink">{goalsDoneCount}</p>
              <p className="text-xs text-ink-muted">goals done</p>
            </div>
          </div>
        </div>

        <p className="mt-4 border-t border-line pt-3 text-xs">
          <Link href="/settings#account" className="text-accent hover:underline">
            Edit your profile →
          </Link>
        </p>
      </section>

      <section className="mb-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Follow someone</h2>
        <p className="mb-4 text-sm text-ink-muted">
          No approval needed — following someone lets you see whatever they&apos;ve chosen to share, right away.
        </p>
        <AddFriendSearch />
        <div className="mt-4">
          <CopyLinkButton path={`/friends/add/${user.username}`} />
        </div>
        <div className="mt-6 border-t border-line pt-4">
          <ShareActivityToggle
            initial={{
              journal: user.shareJournalStreak,
              study: user.shareStudyStreak,
              workout: user.shareWorkoutStreak,
            }}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            Your journal is never visible to anyone, followers included — these only ever cover streaks, never content.
          </p>
        </div>
      </section>

      {followers.length > 0 && (
        <section className="mb-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
          <h2 className="mb-3 font-serif text-lg font-semibold text-ink">
            {followers.length} follower{followers.length === 1 ? "" : "s"}
          </h2>
          <ul className="space-y-2.5">
            {followers.map(({ follower: f }) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={f.name} avatarUrl={f.avatarUrl} size={32} />
                  <span className="min-w-0 truncate text-ink">
                    <span className="font-medium">{f.name}</span> <span className="text-ink-muted">@{f.username}</span>
                  </span>
                </span>
                {followingIdSet.has(f.id) ? (
                  <span className="shrink-0 text-xs text-ink-muted">Following</span>
                ) : (
                  <form action={followUserVoid.bind(null, f.id)}>
                    <button type="submit" className="shrink-0 rounded-lg bg-calm px-3 py-1 text-xs font-medium text-white hover:opacity-90">
                      Follow back
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">
          {following.length === 0 ? "Not following anyone yet" : `Following ${following.length}`}
        </h2>

        {following.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-calm-soft text-calm">
              <UsersIcon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm text-ink-muted">Follow someone above to see their streaks and progress.</p>
          </div>
        )}

        <div className="space-y-3">
          {followingList.map((other) => {
            const activity = activityByUserId.get(other.id);
            const { level: otherLevel } = levelForXp(other.xp);
            return (
              <div key={other.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={other.name} avatarUrl={other.avatarUrl} size={36} />
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-ink">{other.name}</h3>
                      <p className="text-sm text-ink-muted">
                        @{other.username}
                        {followerIdSet.has(other.id) && <span> · Follows you</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-calm-soft px-2.5 py-1 text-xs font-medium text-calm">Lv {otherLevel}</span>
                    <UnfollowButton userId={other.id} name={other.name} />
                  </div>
                </div>

                {activity && (activity.journalStreak != null || activity.studyStreak != null || activity.workoutStreak != null) ? (
                  <div className="mt-3 flex flex-wrap gap-4 border-t border-line pt-3 text-sm">
                    {activity.journalStreak != null && (
                      <span className="flex items-center gap-1.5 text-ink-muted">
                        <JournalIcon className="h-4 w-4 text-accent" />
                        {activity.journalStreak} day{activity.journalStreak === 1 ? "" : "s"}
                      </span>
                    )}
                    {activity.studyStreak != null && (
                      <span className="flex items-center gap-1.5 text-ink-muted">
                        <ClockIcon className="h-4 w-4 text-study" />
                        {activity.studyStreak} day{activity.studyStreak === 1 ? "" : "s"}
                      </span>
                    )}
                    {activity.workoutStreak != null && (
                      <span className="flex items-center gap-1.5 text-ink-muted">
                        <DumbbellIcon className="h-4 w-4 text-workout" />
                        {activity.workoutStreak} day{activity.workoutStreak === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-xs text-ink-muted">
                    <FlameIcon className="h-3.5 w-3.5" />
                    Activity is private
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {following.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-ink-muted">Activity</h2>

          {feed.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
              <p className="text-sm text-ink-muted">
                Nothing from people you follow in the last two weeks — workouts and study sessions show up here once
                someone finishes one and has that category shared.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {feed.map((item) => {
                const followed = followedById.get(item.userId);
                if (!followed) return null;
                return (
                  <li key={`${item.kind}-${item.id}`} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Avatar name={followed.name} avatarUrl={followed.avatarUrl} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">
                          <span className="font-medium">{followed.name}</span>{" "}
                          <span className="text-ink-muted">
                            {item.kind === "workout" ? "finished a workout" : "studied"}
                          </span>
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-ink">
                          {item.title} <span className="font-normal text-ink-muted">· {item.detail}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">{relativeLabel(item.when, today)}</p>
                      </div>
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          item.kind === "workout" ? "bg-workout-soft text-workout" : "bg-study-soft text-study"
                        }`}
                      >
                        {item.kind === "workout" ? (
                          <ActivityIcon className="h-4 w-4" />
                        ) : (
                          <ClockIcon className="h-4 w-4" />
                        )}
                      </span>
                    </div>
                    {item.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photoUrl} alt="" className="mt-3 max-h-80 w-full rounded-xl object-cover" />
                    )}
                    <div className="mt-3 border-t border-line pt-3">
                      <LikeButton
                        kind={item.kind}
                        activityId={item.id}
                        count={likeCountMap.get(item.id) ?? 0}
                        likedByMe={likedByMeSet.has(item.id)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
