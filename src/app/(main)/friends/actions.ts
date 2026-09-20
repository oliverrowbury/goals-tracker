"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { awardBadge } from "@/lib/badges";
import { isBlocked } from "@/lib/friends";
import { setWorkoutArchived } from "../workout/actions";
import { setStudySessionArchived } from "../study/actions";

async function awardFirstFollowBadge(userId: string) {
  const count = await prisma.follow.count({ where: { followerId: userId, status: "ACCEPTED" } });
  if (count >= 1) await awardBadge(userId, "FIRST_FRIEND");
}

export type FriendSearchResult = {
  id: string;
  name: string;
  username: string;
  status: "none" | "requested" | "following";
};

// Username matches as a prefix (like most apps' public-handle search) so
// someone can be found without knowing their exact spelling. Deliberately
// username-only — no name/email search — so the only way to find someone
// is a handle they've actually shared, not by guessing real names or
// (even exact) email addresses.
export async function searchUsers(query: string): Promise<FriendSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const user = await getCurrentUser();
  const candidates = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      username: { startsWith: q },
    },
    select: { id: true, name: true, username: true },
    take: 8,
  });
  if (candidates.length === 0) return [];

  const follows = await prisma.follow.findMany({
    where: { followerId: user.id, followingId: { in: candidates.map((c) => c.id) } },
    select: { followingId: true, status: true },
  });
  const followMap = new Map(follows.map((f) => [f.followingId, f.status]));

  return candidates.map((c) => {
    const status = followMap.get(c.id);
    return { ...c, status: status === "ACCEPTED" ? "following" : status === "PENDING" ? "requested" : "none" };
  });
}

export type FollowState = { error?: string; success?: string } | null;

// Instagram-style — the target has to accept before you actually see
// anything of theirs. Used by search results and the /friends/add/[username]
// share link, where the target is already a resolved user rather than
// free-typed text.
export async function requestFollow(targetUserId: string): Promise<FollowState> {
  const user = await getCurrentUser();
  if (targetUserId === user.id) return { error: "That's you" };

  const other = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!other) return { error: "That account doesn't exist" };
  if (await isBlocked(user.id, other.id)) return { error: "You can't follow this account" };

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId: other.id } },
  });
  if (existing?.status === "ACCEPTED") return { error: `You're already following ${other.name}` };
  if (existing) return { error: `You've already asked to follow ${other.name}` };

  await prisma.follow.create({ data: { followerId: user.id, followingId: other.id, status: "PENDING" } });
  revalidatePath("/friends");
  return { success: `Request sent to ${other.name}` };
}

// Same as requestFollow but discards the result — for the
// /friends/add/[username] page's plain <form action>, which (unlike
// AddFriendSearch) has no client-side state to show a return value in.
export async function requestFollowVoid(targetUserId: string): Promise<void> {
  await requestFollow(targetUserId);
}

export async function acceptFollowRequest(followId: string) {
  const user = await getCurrentUser();
  // findFirst (not findUniqueOrThrow) so a request meant for someone else
  // just no-ops instead of accepting on their behalf.
  const request = await prisma.follow.findFirst({ where: { id: followId, followingId: user.id, status: "PENDING" } });
  if (!request) return;

  await prisma.follow.update({ where: { id: followId }, data: { status: "ACCEPTED" } });
  await awardFirstFollowBadge(request.followerId);
  revalidatePath("/friends");
}

// Covers declining an incoming request, cancelling one you sent, unfollowing
// someone, and removing a follower — all the same "this row shouldn't exist
// anymore" operation, just at different statuses and from either side of it.
export async function removeFollow(followId: string) {
  const user = await getCurrentUser();
  await prisma.follow.deleteMany({
    where: { id: followId, OR: [{ followerId: user.id }, { followingId: user.id }] },
  });
  revalidatePath("/friends");
}

// Same idea as removeFollow, but for callers that only know the other
// user's id, not the Follow row's own id — search results and the
// /friends/add/[username] page, where cancelling a sent request and
// unfollowing look the same (there's only ever one row per direction).
export async function removeFollowByTarget(targetUserId: string) {
  const user = await getCurrentUser();
  await prisma.follow.deleteMany({ where: { followerId: user.id, followingId: targetUserId } });
  revalidatePath("/friends");
}

// Blocking someone also drops any Follow row between you, either
// direction — that alone is what keeps a blocked person's activity out of
// your feed and yours out of theirs, since both feeds are already built
// from "who I follow" (see friends/page.tsx); no separate feed-side
// filter needed. isBlocked (checked in requestFollow, sendMessage, and
// canCommentOn) is what stops a new Follow/message/comment afterward.
export async function blockUser(targetUserId: string) {
  const user = await getCurrentUser();
  if (targetUserId === user.id) return;

  await prisma.$transaction([
    prisma.follow.deleteMany({
      where: { OR: [{ followerId: user.id, followingId: targetUserId }, { followerId: targetUserId, followingId: user.id }] },
    }),
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetUserId } },
      create: { blockerId: user.id, blockedId: targetUserId },
      update: {},
    }),
  ]);
  revalidatePath("/friends");
}

export async function unblockUser(targetUserId: string) {
  const user = await getCurrentUser();
  await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId: targetUserId } });
  revalidatePath("/friends");
}

const MAX_REPORT_REASON_LENGTH = 500;

// No in-app moderation queue — see /admin/reports (ADMIN_EMAIL-gated, same
// pattern as OwnerBadge) for where these actually get read.
export async function submitReport(
  targetType: "USER" | "COMMENT" | "WORKOUT" | "STUDY_SESSION" | "MESSAGE",
  targetUserId: string,
  targetId: string | null,
  reason: string,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { error: "Say a little about what's wrong." };
  if (trimmedReason.length > MAX_REPORT_REASON_LENGTH) return { error: `Keep it under ${MAX_REPORT_REASON_LENGTH} characters.` };

  await prisma.report.create({
    data: { reporterId: user.id, targetUserId, targetType, targetId, reason: trimmedReason },
  });
  return { success: "Thanks — we'll take a look." };
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

// A single dispatch point so the shared ActivityCard doesn't need to know
// which model backs each kind — same idea as likeActivity below.
export async function setActivityArchived(kind: ActivityKind, activityId: string, archived: boolean) {
  if (kind === "workout") await setWorkoutArchived(activityId, archived);
  else await setStudySessionArchived(activityId, archived);
}

// A like on one specific activity in a friend's feed — capped at one per
// person per activity (the unique constraints on Cheer), not per day.
// Re-checks that the liker has an ACCEPTED follow on the owner *and* the
// owner's current share setting for that category server-side rather than
// trusting that the activity only reached this call because it was visible
// in the feed — the feed is the normal path here, but this is the actual
// privacy boundary.
export async function likeActivity(kind: ActivityKind, activityId: string) {
  const user = await getCurrentUser();

  const owner =
    kind === "workout"
      ? await prisma.workout.findUnique({ where: { id: activityId }, select: { userId: true } })
      : await prisma.studySession.findUnique({ where: { id: activityId }, select: { userId: true } });
  if (!owner || owner.userId === user.id) return;

  const [follow, ownerUser] = await Promise.all([
    prisma.follow.findFirst({ where: { followerId: user.id, followingId: owner.userId, status: "ACCEPTED" } }),
    prisma.user.findUnique({
      where: { id: owner.userId },
      select: { shareWorkoutStreak: true, shareStudyStreak: true },
    }),
  ]);
  if (!follow || !ownerUser) return;
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

const MAX_COMMENT_LENGTH = 500;

// Same privacy boundary as the post-detail page's own access check
// (friends/post/[kind]/[id]/page.tsx) — re-verified here rather than
// trusted from wherever the comment form happened to be rendered. Unlike
// likeActivity, commenting on your own post is allowed (no self-block),
// same as any real social app.
async function canCommentOn(userId: string, kind: ActivityKind, activityId: string): Promise<{ ownerId: string } | null> {
  const activity =
    kind === "workout"
      ? await prisma.workout.findUnique({ where: { id: activityId }, select: { userId: true, visibility: true } })
      : await prisma.studySession.findUnique({ where: { id: activityId }, select: { userId: true, visibility: true } });
  if (!activity) return null;
  if (activity.userId === userId) return { ownerId: activity.userId };

  const [follow, ownerUser, blocked] = await Promise.all([
    prisma.follow.findFirst({ where: { followerId: userId, followingId: activity.userId, status: "ACCEPTED" } }),
    prisma.user.findUnique({ where: { id: activity.userId }, select: { shareWorkoutStreak: true, shareStudyStreak: true } }),
    isBlocked(userId, activity.userId),
  ]);
  if (!follow || !ownerUser || blocked || activity.visibility !== "FRIENDS") return null;
  if (kind === "workout" && !ownerUser.shareWorkoutStreak) return null;
  if (kind === "study" && !ownerUser.shareStudyStreak) return null;
  return { ownerId: activity.userId };
}

export type CommentDTO = {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
};

const COMMENT_RATE_LIMIT = 10;
const COMMENT_RATE_WINDOW_MS = 60_000;

export async function addComment(kind: ActivityKind, activityId: string, formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Type something first." };
  if (body.length > MAX_COMMENT_LENGTH) return { error: `Keep it under ${MAX_COMMENT_LENGTH} characters.` };

  const recentCount = await prisma.comment.count({
    where: { authorId: user.id, createdAt: { gt: new Date(Date.now() - COMMENT_RATE_WINDOW_MS) } },
  });
  if (recentCount >= COMMENT_RATE_LIMIT) return { error: "Slow down — too many comments in a row. Try again in a minute." };

  const access = await canCommentOn(user.id, kind, activityId);
  if (!access) return { error: "You can't comment on this." };

  await prisma.comment.create({
    data: {
      authorId: user.id,
      body,
      workoutId: kind === "workout" ? activityId : null,
      studySessionId: kind === "study" ? activityId : null,
    },
  });
  revalidatePath(`/friends/post/${kind}/${activityId}`);
  return {};
}

// The comment's own author, or the activity's owner (same "your post, your
// call" moderation bar most feeds use), can remove it — re-checked here
// rather than trusted from the delete button only being shown to those two
// people client-side.
export async function deleteComment(commentId: string) {
  const user = await getCurrentUser();
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return;

  let ownerId: string | null = null;
  if (comment.workoutId) {
    ownerId = (await prisma.workout.findUnique({ where: { id: comment.workoutId }, select: { userId: true } }))?.userId ?? null;
  } else if (comment.studySessionId) {
    ownerId = (await prisma.studySession.findUnique({ where: { id: comment.studySessionId }, select: { userId: true } }))?.userId ?? null;
  }
  if (comment.authorId !== user.id && ownerId !== user.id) return;

  await prisma.comment.delete({ where: { id: commentId } });
  const kind = comment.workoutId ? "workout" : "study";
  const activityId = comment.workoutId ?? comment.studySessionId;
  revalidatePath(`/friends/post/${kind}/${activityId}`);
}
