import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO } from "@/lib/dates";
import { computeStreak } from "@/lib/streaks";
import { levelForXp } from "@/lib/xp";
import { UsersIcon, FlameIcon, JournalIcon, ClockIcon, DumbbellIcon } from "@/components/Icons";
import { AddFriendForm } from "./AddFriendForm";
import { ShareActivityToggle } from "./ShareActivityToggle";
import { RemoveFriendButton } from "./RemoveFriendButton";
import { acceptFriendRequest, removeFriendship } from "./actions";

export const dynamic = "force-dynamic";

type FriendUser = { id: string; name: string; email: string; shareActivity: boolean; xp: number };

// The only place in the app that reads another user's rows — gated behind
// an ACCEPTED friendship (checked by the caller) and that user's own
// shareActivity opt-in, so it's never reachable just by knowing a user id.
async function friendActivity(userId: string, today: string) {
  const [journalDates, studyDates, workoutDates] = await Promise.all([
    prisma.journalEntry.findMany({ where: { userId, bodyText: { not: "" } }, select: { date: true } }),
    prisma.studySession.findMany({ where: { userId, durationMinutes: { not: null } }, select: { startedAt: true } }),
    prisma.workout.findMany({ where: { userId, endedAt: { not: null } }, select: { date: true } }),
  ]);
  return {
    journalStreak: computeStreak(new Set(journalDates.map((e) => e.date.toISOString().slice(0, 10))), today),
    studyStreak: computeStreak(new Set(studyDates.map((s) => s.startedAt.toISOString().slice(0, 10))), today),
    workoutStreak: computeStreak(new Set(workoutDates.map((w) => w.date.toISOString().slice(0, 10))), today),
  };
}

export default async function FriendsPage() {
  const user = await getCurrentUser();
  const today = todayISO();

  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    include: {
      requester: { select: { id: true, name: true, email: true, shareActivity: true, xp: true } },
      addressee: { select: { id: true, name: true, email: true, shareActivity: true, xp: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const otherUser = (f: (typeof friendships)[number]): FriendUser => (f.requesterId === user.id ? f.addressee : f.requester);

  const accepted = friendships.filter((f) => f.status === "ACCEPTED");
  const incoming = friendships.filter((f) => f.status === "PENDING" && f.addresseeId === user.id);
  const outgoing = friendships.filter((f) => f.status === "PENDING" && f.requesterId === user.id);

  const activityByFriendId = new Map<string, Awaited<ReturnType<typeof friendActivity>>>();
  await Promise.all(
    accepted.map(async (f) => {
      const other = otherUser(f);
      if (!other.shareActivity) return;
      activityByFriendId.set(other.id, await friendActivity(other.id, today));
    }),
  );

  return (
    <div>
      <div className="mb-6 flex items-center gap-2.5">
        <UsersIcon className="h-5 w-5 shrink-0 text-calm" />
        <h1 className="font-serif text-2xl font-semibold text-ink">Friends</h1>
      </div>

      <section className="mb-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Add a friend</h2>
        <p className="mb-4 text-sm text-ink-muted">
          Enter their account email — if they&apos;ve already added you, you&apos;ll be friends right away.
        </p>
        <AddFriendForm />
        <div className="mt-6 border-t border-line pt-4">
          <ShareActivityToggle initial={user.shareActivity} />
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
                    <span className="font-medium">{other.name}</span> <span className="text-ink-muted">({other.email})</span>
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
                    <p className="text-sm text-ink-muted">{other.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-calm-soft px-2.5 py-1 text-xs font-medium text-calm">Lv {level}</span>
                    <RemoveFriendButton friendshipId={f.id} name={other.name} />
                  </div>
                </div>

                {activity ? (
                  <div className="mt-3 flex flex-wrap gap-4 border-t border-line pt-3 text-sm">
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <JournalIcon className="h-4 w-4 text-accent" />
                      {activity.journalStreak} day{activity.journalStreak === 1 ? "" : "s"}
                    </span>
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <ClockIcon className="h-4 w-4 text-study" />
                      {activity.studyStreak} day{activity.studyStreak === 1 ? "" : "s"}
                    </span>
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <DumbbellIcon className="h-4 w-4 text-workout" />
                      {activity.workoutStreak} day{activity.workoutStreak === 1 ? "" : "s"}
                    </span>
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
    </div>
  );
}
