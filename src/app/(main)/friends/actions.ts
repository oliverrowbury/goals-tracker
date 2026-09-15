"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { awardBadge } from "@/lib/badges";

async function awardFirstFollowBadge(userId: string) {
  const count = await prisma.follow.count({ where: { followerId: userId } });
  if (count >= 1) await awardBadge(userId, "FIRST_FRIEND");
}

export type FriendSearchResult = {
  id: string;
  name: string;
  username: string;
  following: boolean;
};

// Username matches as a prefix (like most apps' public-handle search) so
// someone can be found without knowing their exact spelling; email only
// matches exactly, so this can't be used to enumerate every account by
// guessing partial addresses — an email has to already be known to add by it.
export async function searchUsers(query: string): Promise<FriendSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const user = await getCurrentUser();
  const candidates = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      OR: [{ username: { startsWith: q } }, { email: q }],
    },
    select: { id: true, name: true, username: true },
    take: 8,
  });
  if (candidates.length === 0) return [];

  const follows = await prisma.follow.findMany({
    where: { followerId: user.id, followingId: { in: candidates.map((c) => c.id) } },
    select: { followingId: true },
  });
  const followingSet = new Set(follows.map((f) => f.followingId));

  return candidates.map((c) => ({ ...c, following: followingSet.has(c.id) }));
}

export type FollowState = { error?: string; success?: string } | null;

// One-directional — no acceptance needed, same as Strava. Used by search
// results and the /friends/add/[username] share link, where the target is
// already a resolved user rather than free-typed text.
export async function followUser(targetUserId: string): Promise<FollowState> {
  const user = await getCurrentUser();
  if (targetUserId === user.id) return { error: "That's you" };

  const other = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!other) return { error: "That account doesn't exist" };

  try {
    await prisma.follow.create({ data: { followerId: user.id, followingId: other.id } });
  } catch {
    // Unique constraint — already following them.
    return { error: `You're already following ${other.name}` };
  }
  await awardFirstFollowBadge(user.id);
  revalidatePath("/friends");
  return { success: `Now following ${other.name}` };
}

// Same as followUser but discards the result — for the
// /friends/add/[username] page's plain <form action>, which (unlike
// AddFriendSearch) has no client-side state to show a return value in.
export async function followUserVoid(targetUserId: string): Promise<void> {
  await followUser(targetUserId);
}

export async function unfollowUser(targetUserId: string) {
  const user = await getCurrentUser();
  await prisma.follow.deleteMany({ where: { followerId: user.id, followingId: targetUserId } });
  revalidatePath("/friends");
}

export type ShareCategory = "journal" | "study" | "workout";

const SHARE_FIELD: Record<ShareCategory, "shareJournalStreak" | "shareStudyStreak" | "shareWorkoutStreak"> = {
  journal: "shareJournalStreak",
  study: "shareStudyStreak",
  workout: "shareWorkoutStreak",
};

export async function setShareCategory(category: ShareCategory, share: boolean) {
  const user = await getCurrentUser();
  await prisma.user.update({ where: { id: user.id }, data: { [SHARE_FIELD[category]]: share } });
  revalidatePath("/friends");
}

export type ActivityKind = "workout" | "study";

// A like on one specific activity in a friend's feed — capped at one per
// person per activity (the unique constraints on Cheer), not per day.
// Re-checks that the liker actually follows the owner *and* the owner's
// current share setting for that category server-side rather than trusting
// that the activity only reached this call because it was visible in the
// feed — the feed is the normal path here, but this is the actual privacy
// boundary.
export async function likeActivity(kind: ActivityKind, activityId: string) {
  const user = await getCurrentUser();

  const owner =
    kind === "workout"
      ? await prisma.workout.findUnique({ where: { id: activityId }, select: { userId: true } })
      : await prisma.studySession.findUnique({ where: { id: activityId }, select: { userId: true } });
  if (!owner || owner.userId === user.id) return;

  const [follows, ownerUser] = await Promise.all([
    prisma.follow.findFirst({ where: { followerId: user.id, followingId: owner.userId } }),
    prisma.user.findUnique({
      where: { id: owner.userId },
      select: { shareWorkoutStreak: true, shareStudyStreak: true },
    }),
  ]);
  if (!follows || !ownerUser) return;
  if (kind === "workout" && !ownerUser.shareWorkoutStreak) return;
  if (kind === "study" && !ownerUser.shareStudyStreak) return;

  try {
    await prisma.cheer.create({
      data: {
        fromUserId: user.id,
        toUserId: owner.userId,
        workoutId: kind === "workout" ? activityId : null,
        studySessionId: kind === "study" ? activityId : null,
      },
    });
  } catch {
    // Already liked this activity — the unique constraint caught it.
  }
  revalidatePath("/friends");
}
