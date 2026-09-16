import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, formatMonthYear } from "@/lib/dates";
import { computeStreak } from "@/lib/streaks";
import { levelForXp } from "@/lib/xp";
import { ADMIN_EMAIL } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { OwnerBadge } from "@/components/OwnerBadge";
import { UsersIcon, JournalIcon, ClockIcon, DumbbellIcon, FlameIcon } from "@/components/Icons";
import { FocusTagPills } from "../../FocusTagPills";
import { requestFollowVoid, removeFollowByTarget } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await getCurrentUser();
  const target = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!target) notFound();

  const isSelf = target.id === user.id;

  const [outgoing, followerCount, followingCount] = await Promise.all([
    isSelf
      ? null
      : prisma.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: target.id } } }),
    prisma.follow.count({ where: { followingId: target.id, status: "ACCEPTED" } }),
    prisma.follow.count({ where: { followerId: target.id, status: "ACCEPTED" } }),
  ]);

  const isFollowing = outgoing?.status === "ACCEPTED";
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

      <Link href="/friends" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-ink-muted hover:text-calm">
        <UsersIcon className="h-4 w-4" />
        Back to friends
      </Link>
    </div>
  );
}
