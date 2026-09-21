"use server";

import { baseUrl } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { generateSessionToken } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/email";

const VERIFY_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

// Re-sends the same link signup already sent — for whoever missed the
// first one or waited past its 48-hour expiry. Regenerates the token
// either way, so an old copy of the email stops working the moment a new
// one's requested.
export async function resendVerificationEmail() {
  const user = await getCurrentUser();
  if (user.emailVerifiedAt) return;

  const verifyToken = generateSessionToken();
  const verifyTokenExpiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  await prisma.user.update({ where: { id: user.id }, data: { verifyToken, verifyTokenExpiresAt } });

  await sendVerificationEmail(user.email, user.name, `${await baseUrl()}/api/verify-email?token=${verifyToken}`);
}

export type NotificationPerson = { name: string; username: string; avatarUrl: string | null };

export type FollowRequestNotification = {
  kind: "follow_request";
  followId: string;
  person: NotificationPerson;
  createdAt: string;
};

export type ActivityNotification = {
  kind: "like" | "comment";
  id: string;
  person: NotificationPerson;
  activityKind: "workout" | "study";
  activityId: string;
  title: string;
  body?: string;
  createdAt: string;
};

// Everything the notification bell shows, fetched together and on demand
// (only when the bell's actually opened) rather than on every single page
// load — unlike the badge counts in (main)/layout.tsx, which have to be
// cheap enough to run everywhere. Also marks likes/comments as seen, same
// "opening the place that shows them is what clears them" convention
// likesSeenAt already used before this existed (see commentsSeenAt's
// comment in schema.prisma for why comments need their own cursor).
export async function getNotifications(): Promise<{ followRequests: FollowRequestNotification[]; activity: ActivityNotification[] }> {
  const user = await getCurrentUser();

  const [incoming, cheers, myWorkouts, myStudySessions] = await Promise.all([
    prisma.follow.findMany({
      where: { followingId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { follower: { select: { name: true, username: true, avatarUrl: true } } },
    }),
    prisma.cheer.findMany({
      where: { toUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { fromUser: { select: { name: true, username: true, avatarUrl: true } } },
    }),
    prisma.workout.findMany({ where: { userId: user.id }, select: { id: true } }),
    prisma.studySession.findMany({ where: { userId: user.id }, select: { id: true } }),
  ]);

  const myWorkoutIds = myWorkouts.map((w) => w.id);
  const myStudySessionIds = myStudySessions.map((s) => s.id);

  const comments =
    myWorkoutIds.length > 0 || myStudySessionIds.length > 0
      ? await prisma.comment.findMany({
          where: {
            authorId: { not: user.id },
            OR: [{ workoutId: { in: myWorkoutIds } }, { studySessionId: { in: myStudySessionIds } }],
          },
          orderBy: { createdAt: "desc" },
          take: 15,
          include: { author: { select: { name: true, username: true, avatarUrl: true } } },
        })
      : [];

  // One shared title lookup for both likes and comments — "liked your
  // Push day" reads far better than "liked your workout".
  const titleWorkoutIds = [...cheers, ...comments].map((c) => c.workoutId).filter((id): id is string => !!id);
  const titleSessionIds = [...cheers, ...comments].map((c) => c.studySessionId).filter((id): id is string => !!id);
  const [titleWorkouts, titleSessions] = await Promise.all([
    titleWorkoutIds.length > 0
      ? prisma.workout.findMany({ where: { id: { in: titleWorkoutIds } }, select: { id: true, label: true } })
      : [],
    titleSessionIds.length > 0
      ? prisma.studySession.findMany({ where: { id: { in: titleSessionIds } }, select: { id: true, subject: { select: { name: true } } } })
      : [],
  ]);
  const workoutTitleById = new Map(titleWorkouts.map((w) => [w.id, w.label]));
  const sessionTitleById = new Map(titleSessions.map((s) => [s.id, s.subject.name]));
  const titleFor = (workoutId: string | null, studySessionId: string | null) =>
    (workoutId ? workoutTitleById.get(workoutId) : studySessionId ? sessionTitleById.get(studySessionId) : undefined) ?? "a post";

  const followRequests: FollowRequestNotification[] = incoming.map((f) => ({
    kind: "follow_request",
    followId: f.id,
    person: f.follower,
    createdAt: f.createdAt.toISOString(),
  }));

  const activity: ActivityNotification[] = [
    ...cheers.map((c) => ({
      kind: "like" as const,
      id: c.id,
      person: c.fromUser,
      activityKind: (c.workoutId ? "workout" : "study") as "workout" | "study",
      activityId: (c.workoutId ?? c.studySessionId)!,
      title: titleFor(c.workoutId, c.studySessionId),
      createdAt: c.createdAt.toISOString(),
    })),
    ...comments.map((c) => ({
      kind: "comment" as const,
      id: c.id,
      person: c.author,
      activityKind: (c.workoutId ? "workout" : "study") as "workout" | "study",
      activityId: (c.workoutId ?? c.studySessionId)!,
      title: titleFor(c.workoutId, c.studySessionId),
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  await prisma.user.update({ where: { id: user.id }, data: { likesSeenAt: new Date(), commentsSeenAt: new Date() } });

  return { followRequests, activity };
}
