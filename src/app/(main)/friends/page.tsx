import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, shiftISO, isoToDate, weekdayShortDayMonth, formatMonthYear } from "@/lib/dates";
import { levelForXp } from "@/lib/xp";
import { formatMinutes } from "@/lib/study";
import { formatDistance, formatPace } from "@/lib/workout";
import { Avatar } from "@/components/Avatar";
import { OwnerBadge } from "@/components/OwnerBadge";
import { ADMIN_EMAIL } from "@/lib/auth";
import { UsersIcon, JournalIcon, ClockIcon, DumbbellIcon, ActivityIcon, TargetIcon } from "@/components/Icons";
import { AddFriendSearch } from "./AddFriendSearch";
import { ShareActivityToggle } from "./ShareActivityToggle";
import { LikeButton } from "./LikeButton";
import { CopyLinkButton } from "./CopyLinkButton";
import { FocusTagPills } from "./FocusTagPills";
import { requestFollowVoid, acceptFollowRequest, removeFollow } from "./actions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

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
  note?: string | null;
  photoUrl?: string | null;
};

const PROFILE_SELECT = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  shareJournalStreak: true,
  shareStudyStreak: true,
  shareWorkoutStreak: true,
  xp: true,
} as const;

export default async function FriendsPage() {
  const user = await getCurrentUser();
  const today = todayISO();

  // Opening this page is "I've seen my likes" — same convention as
  // messages/actions.ts's markThreadRead. Awaited rather than left dangling
  // — see signup/actions.ts's note on why an unawaited write can get cut
  // off once a serverless function's response finishes.
  await prisma.user.update({ where: { id: user.id }, data: { likesSeenAt: new Date() } });

  const [following, followers, incomingRequests, outgoingRequests, journalCount, studySessionCount, workoutCount, goalsDoneCount] =
    await Promise.all([
      prisma.follow.findMany({
        where: { followerId: user.id, status: "ACCEPTED" },
        include: { following: { select: PROFILE_SELECT } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.follow.findMany({
        where: { followingId: user.id, status: "ACCEPTED" },
        include: { follower: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.follow.findMany({
        where: { followingId: user.id, status: "PENDING" },
        include: { follower: { select: { id: true, name: true, username: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.follow.findMany({
        where: { followerId: user.id, status: "PENDING" },
        include: { following: { select: { id: true, name: true, username: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.journalEntry.count({ where: { userId: user.id, bodyText: { not: "" } } }),
      prisma.studySession.count({ where: { userId: user.id, durationMinutes: { not: null } } }),
      prisma.workout.count({ where: { userId: user.id, endedAt: { not: null } } }),
      prisma.goalLog.count({ where: { completed: true, goal: { userId: user.id } } }),
    ]);

  const followingList = following.map((f) => f.following);
  const followingIdSet = new Set(followingList.map((f) => f.id));
  // Someone I already have a pending or accepted row toward, from either
  // side — used to hide the "Follow back" button once a request is already
  // in flight rather than letting it be sent twice.
  const outgoingTargetIdSet = new Set(outgoingRequests.map((f) => f.following.id));

  const followedById = new Map(followingList.map((f) => [f.id, f]));
  const shareWorkoutIds = followingList.filter((o) => o.shareWorkoutStreak).map((o) => o.id);
  const shareStudyIds = followingList.filter((o) => o.shareStudyStreak).map((o) => o.id);

  // Last two weeks, most recent 25 — a live feed, not a full archive (each
  // person's own history already lives on their Study/Workout pages).
  const FEED_SINCE = isoToDate(shiftISO(today, -14));
  const FEED_LIMIT = 25;

  const [feedWorkouts, feedStudySessions] = await Promise.all([
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
      note: w.note,
      photoUrl: w.photoUrl,
    })),
    ...feedStudySessions.map((s) => ({
      id: s.id,
      kind: "study" as const,
      userId: s.userId,
      when: s.endedAt!,
      note: s.note,
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
      <PageHeader icon={UsersIcon} iconClassName="text-calm" title="Friends" />

      <section className="mb-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <Avatar name={user.name} avatarUrl={user.avatarUrl} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-lg font-semibold text-ink">{user.name}</h2>
              {user.email === ADMIN_EMAIL && <OwnerBadge />}
              <span className="rounded-full bg-calm-soft px-2.5 py-0.5 text-xs font-medium text-calm">Lv {level}</span>
            </div>
            <p className="text-sm text-ink-muted">
              @{user.username}
              {user.pronouns && <span> · {user.pronouns}</span>}
              {user.city && <span> · {user.city}</span>}
            </p>
            {user.bio && <p className="mt-1.5 text-sm text-ink">{user.bio}</p>}
            <p className="mt-1.5 text-xs text-ink-muted">Joined {formatMonthYear(user.createdAt)}</p>
          </div>
        </div>

        {user.focusTags.length > 0 && (
          <div className="mt-3">
            <FocusTagPills tags={user.focusTags} />
          </div>
        )}

        <div className="mt-4 flex gap-5 border-t border-line pt-4 text-sm">
          <Link href={`/friends/${user.username}/following`} className="hover:opacity-70">
            <span className="font-serif text-base font-semibold text-ink">{following.length}</span>{" "}
            <span className="text-ink-muted">following</span>
          </Link>
          <Link href={`/friends/${user.username}/followers`} className="hover:opacity-70">
            <span className="font-serif text-base font-semibold text-ink">{followers.length}</span>{" "}
            <span className="text-ink-muted">followers</span>
          </Link>
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
          They have to accept before you see anything of theirs — and them accepting doesn&apos;t mean they follow you
          back.
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

      {incomingRequests.length > 0 && (
        <section className="mb-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
          <h2 className="mb-3 font-serif text-lg font-semibold text-ink">
            {incomingRequests.length} follow request{incomingRequests.length === 1 ? "" : "s"}
          </h2>
          <ul className="space-y-2.5">
            {incomingRequests.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">
                  <span className="font-medium">{f.follower.name}</span>{" "}
                  <span className="text-ink-muted">@{f.follower.username}</span>
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <form action={acceptFollowRequest.bind(null, f.id)}>
                    <button type="submit" className="rounded-lg bg-calm px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
                      Accept
                    </button>
                  </form>
                  <form action={removeFollow.bind(null, f.id)}>
                    <button type="submit" className="text-ink-muted hover:text-accent">
                      Decline
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoingRequests.length > 0 && (
        <section className="mb-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
          <h2 className="mb-3 font-serif text-lg font-semibold text-ink">Sent</h2>
          <ul className="space-y-2.5">
            {outgoingRequests.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-muted">
                  Waiting for <span className="font-medium text-ink">{f.following.name}</span> to accept
                </span>
                <form action={removeFollow.bind(null, f.id)}>
                  <button type="submit" className="text-ink-muted hover:text-accent">
                    Cancel
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {followers.length > 0 && (
        <section className="mb-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
          <h2 className="mb-3 font-serif text-lg font-semibold text-ink">
            {followers.length} follower{followers.length === 1 ? "" : "s"}
          </h2>
          <ul className="space-y-2.5">
            {followers.map(({ follower: f }) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                <Link href={`/friends/add/${f.username}`} className="flex min-w-0 items-center gap-2.5 hover:opacity-80">
                  <Avatar name={f.name} avatarUrl={f.avatarUrl} size={32} />
                  <span className="min-w-0 truncate text-ink">
                    <span className="font-medium">{f.name}</span> <span className="text-ink-muted">@{f.username}</span>
                  </span>
                </Link>
                {followingIdSet.has(f.id) ? (
                  <span className="shrink-0 text-xs text-ink-muted">Following</span>
                ) : outgoingTargetIdSet.has(f.id) ? (
                  <span className="shrink-0 text-xs text-ink-muted">Requested</span>
                ) : (
                  <form action={requestFollowVoid.bind(null, f.id)}>
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

      {following.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-ink-muted">Activity</h2>

          {feed.length === 0 ? (
            <EmptyState message="Nothing from people you follow in the last two weeks — workouts and study sessions show up here once someone finishes one and has that category shared." />
          ) : (
            <ul className="space-y-3">
              {feed.map((item) => {
                const followed = followedById.get(item.userId);
                if (!followed) return null;
                // Avatar links to the profile; the rest of the post (text
                // and, when there's one, the photo — the main event, Insta-
                // style) links to the post's own detail view. Two sibling
                // links rather than one wrapping the whole card, since a
                // link can't be nested inside another link.
                return (
                  <li key={`${item.kind}-${item.id}`} className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
                    <div className="flex items-start gap-3 p-4">
                      <Link href={`/friends/add/${followed.username}`} className="shrink-0">
                        <Avatar name={followed.name} avatarUrl={followed.avatarUrl} size={32} />
                      </Link>
                      <Link href={`/friends/post/${item.kind}/${item.id}`} className="min-w-0 flex-1 hover:opacity-90">
                        <p className="text-sm text-ink">
                          <span className="font-medium">{followed.name}</span>{" "}
                          <span className="text-ink-muted">
                            {item.kind === "workout" ? "finished a workout" : "studied"}
                          </span>
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-ink">
                          {item.title} <span className="font-normal text-ink-muted">· {item.detail}</span>
                        </p>
                        {item.note && <p className="mt-1 text-sm text-ink">{item.note}</p>}
                        <p className="mt-0.5 text-xs text-ink-muted">{relativeLabel(item.when, today)}</p>
                      </Link>
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
                      <Link href={`/friends/post/${item.kind}/${item.id}`} className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.photoUrl} alt="" className="aspect-square w-full object-cover" />
                      </Link>
                    )}
                    <div className="border-t border-line px-4 py-3">
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
