import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, shiftISO, isoToDate, weekdayShortDayMonth } from "@/lib/dates";
import { computeStreak } from "@/lib/streaks";
import { levelForXp } from "@/lib/xp";
import { formatMinutes } from "@/lib/study";
import { formatDistance, formatPace } from "@/lib/workout";
import { UsersIcon, FlameIcon, JournalIcon, ClockIcon, DumbbellIcon, ActivityIcon } from "@/components/Icons";
import { AddFriendSearch } from "./AddFriendSearch";
import { ShareActivityToggle } from "./ShareActivityToggle";
import { RemoveFriendButton } from "./RemoveFriendButton";
import { LikeButton } from "./LikeButton";
import { CopyLinkButton } from "./CopyLinkButton";
import { acceptFriendRequest, removeFriendship } from "./actions";

export const dynamic = "force-dynamic";

type FriendUser = {
  id: string;
  name: string;
  username: string;
  shareJournalStreak: boolean;
  shareStudyStreak: boolean;
  shareWorkoutStreak: boolean;
  xp: number;
};

// The only place in the app that reads another user's rows — gated behind
// an ACCEPTED friendship (checked by the caller) and, per category, that
// user's own share*Streak opt-in, so it's never reachable just by knowing
// a user id. Journal *content* is never included here regardless — only
// whether an entry exists on a given day, the same way the streak is
// already computed for the signed-in user's own settings page. Each
// category is fetched independently so one friend can show their workout
// streak without also showing their journal streak.
async function friendActivity(other: FriendUser, today: string) {
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

  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    include: {
      requester: {
        select: {
          id: true,
          name: true,
          username: true,
          shareJournalStreak: true,
          shareStudyStreak: true,
          shareWorkoutStreak: true,
          xp: true,
        },
      },
      addressee: {
        select: {
          id: true,
          name: true,
          username: true,
          shareJournalStreak: true,
          shareStudyStreak: true,
          shareWorkoutStreak: true,
          xp: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const otherUser = (f: (typeof friendships)[number]): FriendUser => (f.requesterId === user.id ? f.addressee : f.requester);

  const accepted = friendships.filter((f) => f.status === "ACCEPTED");
  const incoming = friendships.filter((f) => f.status === "PENDING" && f.addresseeId === user.id);
  const outgoing = friendships.filter((f) => f.status === "PENDING" && f.requesterId === user.id);
  const friendIds = accepted.map((f) => otherUser(f).id);

  const friendById = new Map(accepted.map((f) => [otherUser(f).id, otherUser(f)]));
  const shareWorkoutFriendIds = accepted.map(otherUser).filter((o) => o.shareWorkoutStreak).map((o) => o.id);
  const shareStudyFriendIds = accepted.map(otherUser).filter((o) => o.shareStudyStreak).map((o) => o.id);

  // Last two weeks, most recent 25 — a live feed, not a full archive (each
  // friend's own history already lives on their Study/Workout pages).
  const FEED_SINCE = isoToDate(shiftISO(today, -14));
  const FEED_LIMIT = 25;

  const [activityByFriendId, feedWorkouts, feedStudySessions] = await Promise.all([
    (async () => {
      const map = new Map<string, Awaited<ReturnType<typeof friendActivity>>>();
      await Promise.all(
        accepted.map(async (f) => {
          const other = otherUser(f);
          if (!other.shareJournalStreak && !other.shareStudyStreak && !other.shareWorkoutStreak) return;
          map.set(other.id, await friendActivity(other, today));
        }),
      );
      return map;
    })(),
    shareWorkoutFriendIds.length > 0
      ? prisma.workout.findMany({
          where: { userId: { in: shareWorkoutFriendIds }, endedAt: { gte: FEED_SINCE }, visibility: "FRIENDS" },
          orderBy: { endedAt: "desc" },
          take: FEED_LIMIT,
        })
      : [],
    shareStudyFriendIds.length > 0
      ? prisma.studySession.findMany({
          where: { userId: { in: shareStudyFriendIds }, endedAt: { gte: FEED_SINCE }, visibility: "FRIENDS" },
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

  return (
    <div>
      <div className="mb-6 flex items-center gap-2.5">
        <UsersIcon className="h-5 w-5 shrink-0 text-calm" />
        <h1 className="font-serif text-2xl font-semibold text-ink">Friends</h1>
      </div>

      <section className="mb-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Add a friend</h2>
        <p className="mb-4 text-sm text-ink-muted">
          Search by username, or share your own link below — either way, they have to accept before you&apos;re friends.
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
            Your journal is never visible to anyone, friends included — these only ever cover streaks, never content.
          </p>
        </div>
      </section>

      {incoming.length > 0 && (
        <section className="mb-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
          <h2 className="mb-3 font-serif text-lg font-semibold text-ink">Requests</h2>
          <ul className="space-y-2.5">
            {incoming.map((f) => {
              const other = otherUser(f);
              return (
                <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink">
                    <span className="font-medium">{other.name}</span> <span className="text-ink-muted">@{other.username}</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <form action={acceptFriendRequest.bind(null, f.id)}>
                      <button type="submit" className="rounded-lg bg-calm px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
                        Accept
                      </button>
                    </form>
                    <form action={removeFriendship.bind(null, f.id)}>
                      <button type="submit" className="text-ink-muted hover:text-accent">
                        Decline
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="mb-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
          <h2 className="mb-3 font-serif text-lg font-semibold text-ink">Sent</h2>
          <ul className="space-y-2.5">
            {outgoing.map((f) => {
              const other = otherUser(f);
              return (
                <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-muted">
                    Waiting for <span className="font-medium text-ink">{other.name}</span> to accept
                  </span>
                  <form action={removeFriendship.bind(null, f.id)}>
                    <button type="submit" className="text-ink-muted hover:text-accent">
                      Cancel
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted">
          {accepted.length === 0 ? "No friends yet" : `${accepted.length} friend${accepted.length === 1 ? "" : "s"}`}
        </h2>

        {accepted.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-calm-soft text-calm">
              <UsersIcon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm text-ink-muted">Add someone above to see each other&apos;s streaks and progress.</p>
          </div>
        )}

        <div className="space-y-3">
          {accepted.map((f) => {
            const other = otherUser(f);
            const activity = activityByFriendId.get(other.id);
            const { level } = levelForXp(other.xp);
            return (
              <div key={f.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-ink">{other.name}</h3>
                    <p className="text-sm text-ink-muted">@{other.username}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-calm-soft px-2.5 py-1 text-xs font-medium text-calm">Lv {level}</span>
                    <RemoveFriendButton friendshipId={f.id} name={other.name} />
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

      {accepted.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-ink-muted">Activity</h2>

          {feed.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
              <p className="text-sm text-ink-muted">
                Nothing from friends in the last two weeks — workouts and study sessions show up here once someone finishes
                one and has that category shared.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {feed.map((item) => {
                const friend = friendById.get(item.userId);
                if (!friend) return null;
                return (
                  <li key={`${item.kind}-${item.id}`} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
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
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">
                          <span className="font-medium">{friend.name}</span>{" "}
                          <span className="text-ink-muted">
                            {item.kind === "workout" ? "finished a workout" : "studied"}
                          </span>
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-ink">
                          {item.title} <span className="font-normal text-ink-muted">· {item.detail}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">{relativeLabel(item.when, today)}</p>
                      </div>
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
