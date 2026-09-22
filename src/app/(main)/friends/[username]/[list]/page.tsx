import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO } from "@/lib/dates";
import { levelForXp } from "@/lib/xp";
import { followedActivity, type FollowedUser } from "@/lib/friends";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { UsersIcon, JournalIcon, ClockIcon, DumbbellIcon, FlameIcon } from "@/components/Icons";
import { UnfollowButton } from "../../UnfollowButton";
import { requestFollowVoid } from "../../actions";

export const dynamic = "force-dynamic";

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

// Who you follow, or who follows you — for yourself, or anyone you follow
// (browsing a stranger's connections isn't allowed, same privacy bar as
// their activity/streaks). Was previously always shown inline on the main
// Friends page for "following" specifically; moved behind the profile
// card's now-clickable following/followers counts to declutter that page
// down to profile + activity feed.
export default async function ConnectionsPage({ params }: { params: Promise<{ username: string; list: string }> }) {
  const { username, list } = await params;
  if (list !== "following" && list !== "followers") notFound();

  const viewer = await getCurrentUser();
  const target = await prisma.user.findUnique({ where: { username: username.toLowerCase() }, select: { id: true, name: true, username: true } });
  if (!target) notFound();

  const isSelf = target.id === viewer.id;
  if (!isSelf) {
    const viewerFollowsTarget = await prisma.follow.findFirst({
      where: { followerId: viewer.id, followingId: target.id, status: "ACCEPTED" },
    });
    if (!viewerFollowsTarget) redirect(`/friends/add/${target.username}`);
  }

  const people: FollowedUser[] =
    list === "following"
      ? (
          await prisma.follow.findMany({
            where: { followerId: target.id, status: "ACCEPTED" },
            include: { following: { select: PROFILE_SELECT } },
            orderBy: { createdAt: "desc" },
          })
        ).map((r) => r.following)
      : (
          await prisma.follow.findMany({
            where: { followingId: target.id, status: "ACCEPTED" },
            include: { follower: { select: PROFILE_SELECT } },
            orderBy: { createdAt: "desc" },
          })
        ).map((r) => r.follower);

  // "Follows you" / Message are always relative to the person actually
  // looking at the page, not to `target` — so browsing a friend's
  // following list still shows *you* which of those people follow *you*.
  const viewerFollowerIds =
    list === "following" && people.length > 0
      ? new Set(
          (
            await prisma.follow.findMany({
              where: { followingId: viewer.id, status: "ACCEPTED", followerId: { in: people.map((p) => p.id) } },
              select: { followerId: true },
            })
          ).map((f) => f.followerId),
        )
      : new Set<string>();

  // Only meaningful on your OWN followers list — "Follow back" is about
  // whether *you* (the viewer) already follow each person, which only
  // lines up with "follow back" semantics when you're looking at your own
  // followers, not someone else's.
  const [followingIdSet, outgoingTargetIdSet] =
    isSelf && list === "followers" && people.length > 0
      ? await Promise.all([
          prisma.follow
            .findMany({
              where: { followerId: viewer.id, status: "ACCEPTED", followingId: { in: people.map((p) => p.id) } },
              select: { followingId: true },
            })
            .then((rows) => new Set(rows.map((r) => r.followingId))),
          prisma.follow
            .findMany({
              where: { followerId: viewer.id, status: "PENDING", followingId: { in: people.map((p) => p.id) } },
              select: { followingId: true },
            })
            .then((rows) => new Set(rows.map((r) => r.followingId))),
        ])
      : [new Set<string>(), new Set<string>()];

  const today = todayISO();
  const activityByUserId =
    list === "following"
      ? new Map(
          await Promise.all(
            people
              .filter((p) => p.shareJournalStreak || p.shareStudyStreak || p.shareWorkoutStreak)
              .map(async (p) => [p.id, await followedActivity(p, today)] as const),
          ),
        )
      : new Map();

  return (
    <div>
      <PageHeader
        icon={UsersIcon}
        iconClassName="text-calm"
        title={list === "following" ? "Following" : "Followers"}
        subtitle={<p className="text-sm text-ink-muted">@{target.username}</p>}
        align="baseline"
        right={
          <Link href={isSelf ? "/friends" : `/friends/add/${target.username}`} className="text-sm text-ink-muted hover:text-calm">
            ← Back
          </Link>
        }
      />

      {people.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          iconClassName="bg-calm-soft text-calm"
          message={list === "following" ? "Not following anyone yet." : "No followers yet."}
        />
      ) : list === "followers" ? (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 p-4">
              <Link href={`/friends/add/${p.username}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
                <Avatar name={p.name} avatarUrl={p.avatarUrl} size={36} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{p.name}</p>
                  <p className="truncate text-sm text-ink-muted">@{p.username}</p>
                </div>
              </Link>
              {isSelf &&
                (followingIdSet.has(p.id) ? (
                  <span className="shrink-0 text-xs text-ink-muted">Following</span>
                ) : outgoingTargetIdSet.has(p.id) ? (
                  <span className="shrink-0 text-xs text-ink-muted">Requested</span>
                ) : (
                  <form action={requestFollowVoid.bind(null, p.id)}>
                    <button type="submit" className="shrink-0 rounded-lg bg-calm px-3 py-1 text-xs font-medium text-white hover:opacity-90">
                      Follow back
                    </button>
                  </form>
                ))}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3">
          {people.map((other) => {
            const activity = activityByUserId.get(other.id);
            const { level: otherLevel } = levelForXp(other.xp);
            const followsViewer = viewerFollowerIds.has(other.id);
            return (
              <div key={other.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <Link href={`/friends/add/${other.username}`} className="flex min-w-0 items-center gap-2.5 hover:opacity-80">
                    <Avatar name={other.name} avatarUrl={other.avatarUrl} size={36} />
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-ink">{other.name}</h3>
                      <p className="text-sm text-ink-muted">
                        @{other.username}
                        {followsViewer && <span> · Follows you</span>}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-calm-soft px-2.5 py-1 text-xs font-medium text-calm">Lv {otherLevel}</span>
                    {followsViewer && (
                      <Link href={`/messages/${other.username}`} className="text-sm text-ink-muted hover:text-calm">
                        Message
                      </Link>
                    )}
                    {isSelf && <UnfollowButton userId={other.id} name={other.name} />}
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
      )}
    </div>
  );
}
