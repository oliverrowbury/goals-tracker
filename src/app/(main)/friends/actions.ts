"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

export type FriendSearchResult = {
  id: string;
  name: string;
  username: string;
  status: "none" | "pending_sent" | "pending_received" | "friends";
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

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: { in: candidates.map((c) => c.id) } },
        { addresseeId: user.id, requesterId: { in: candidates.map((c) => c.id) } },
      ],
    },
  });

  return candidates.map((c) => {
    const f = friendships.find((f) => f.requesterId === c.id || f.addresseeId === c.id);
    let status: FriendSearchResult["status"] = "none";
    if (f?.status === "ACCEPTED") status = "friends";
    else if (f?.requesterId === user.id) status = "pending_sent";
    else if (f) status = "pending_received";
    return { ...c, status };
  });
}

export type FriendRequestState = { error?: string; success?: string } | null;

async function createOrAcceptRequest(userId: string, otherId: string, otherName: string): Promise<FriendRequestState> {
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: userId },
      ],
    },
  });

  if (existing?.status === "ACCEPTED") return { error: `You're already friends with ${otherName}` };
  if (existing && existing.requesterId === userId) return { error: `You've already sent ${otherName} a request` };

  if (existing && existing.requesterId === otherId) {
    // They already requested you — this is a mutual add, accept it
    // outright instead of leaving two crossed pending requests.
    await prisma.friendship.update({ where: { id: existing.id }, data: { status: "ACCEPTED" } });
    revalidatePath("/friends");
    return { success: `You and ${otherName} are now friends` };
  }

  await prisma.friendship.create({ data: { requesterId: userId, addresseeId: otherId } });
  revalidatePath("/friends");
  return { success: `Request sent to ${otherName}` };
}

// Used by search results and the /friends/add/[username] share link, where
// the target is already a resolved user rather than free-typed text.
export async function sendFriendRequestTo(targetUserId: string): Promise<FriendRequestState> {
  const user = await getCurrentUser();
  if (targetUserId === user.id) return { error: "That's you" };

  const other = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!other) return { error: "That account doesn't exist" };

  return createOrAcceptRequest(user.id, other.id, other.name);
}

// Same as sendFriendRequestTo but discards the result — for the
// /friends/add/[username] page's plain <form action>, which (unlike
// AddFriendSearch) has no client-side state to show a return value in.
export async function sendFriendRequestToVoid(targetUserId: string): Promise<void> {
  await sendFriendRequestTo(targetUserId);
}

export async function acceptFriendRequest(friendshipId: string) {
  const user = await getCurrentUser();
  // findFirst (not findUniqueOrThrow) so a request meant for someone else
  // just no-ops instead of accepting on their behalf.
  const request = await prisma.friendship.findFirst({ where: { id: friendshipId, addresseeId: user.id } });
  if (!request) return;

  await prisma.friendship.update({ where: { id: friendshipId }, data: { status: "ACCEPTED" } });
  revalidatePath("/friends");
}

// Covers declining a pending request, cancelling one you sent, and
// removing an existing friend — all the same "this row shouldn't exist
// anymore" operation, just at different statuses.
export async function removeFriendship(friendshipId: string) {
  const user = await getCurrentUser();
  await prisma.friendship.deleteMany({
    where: { id: friendshipId, OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
  });
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
// Re-checks the friendship *and* the owner's current share setting for that
// category server-side rather than trusting that the activity only reached
// this call because it was visible in the feed — the feed is the normal
// path here, but this is the actual privacy boundary.
export async function likeActivity(kind: ActivityKind, activityId: string) {
  const user = await getCurrentUser();

  const owner =
    kind === "workout"
      ? await prisma.workout.findUnique({ where: { id: activityId }, select: { userId: true } })
      : await prisma.studySession.findUnique({ where: { id: activityId }, select: { userId: true } });
  if (!owner || owner.userId === user.id) return;

  const [friendship, ownerUser] = await Promise.all([
    prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: user.id, addresseeId: owner.userId },
          { requesterId: owner.userId, addresseeId: user.id },
        ],
      },
    }),
    prisma.user.findUnique({
      where: { id: owner.userId },
      select: { shareWorkoutStreak: true, shareStudyStreak: true },
    }),
  ]);
  if (!friendship || !ownerUser) return;
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
