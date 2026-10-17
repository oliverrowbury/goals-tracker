"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { daysAgo, todayISO, dateToISO } from "@/lib/dates";
import { generatePersonalizedPrompt } from "@/lib/ai";
import { resendVerificationCode } from "../signup/verify/actions";

// Re-sends a fresh 6-digit code — for whoever missed the one signup sent,
// or waited past its 15-minute expiry. Same cooldown/regeneration logic
// signup's own "Resend code" button uses.
export async function resendVerificationEmail() {
  const user = await getCurrentUser();
  if (user.emailVerifiedAt) return;
  await resendVerificationCode(user.email);
}

// Marks a free-tier user's one-time full weekly recap as used. Called from
// a client effect once the full recap has actually rendered — not from the
// page's own render body, which Next.js may invoke more than once per
// request in dev to catch impure renders, and did: writing here straight
// from HomePage flipped the lock on before the first (real) response ever
// reached the browser. updateMany + the freeRecapShownAt: null guard makes
// a duplicate call from a double-mounted effect harmless.
export async function markFreeRecapSeen() {
  const user = await getCurrentUser();
  if (user.isPremium) return;
  await prisma.user.updateMany({ where: { id: user.id, freeRecapShownAt: null }, data: { freeRecapShownAt: new Date() } });
}

// Premium's AI-personalized Prompt of the Day. Called from a client effect
// (see GeneratePersonalizedPrompt.tsx) rather than HomePage's own render
// body — writing there would hit the exact same impure-render bug
// markFreeRecapSeen's own comment above describes. Idempotent per day: a
// second call once today's prompt is already cached is a no-op, so a
// double-mounted effect (or a second tab) never burns two API calls.
export async function generateTodaysPrompt() {
  const user = await getCurrentUser();
  if (!user.isPremium) return;
  if (user.personalizedPromptDate && dateToISO(user.personalizedPromptDate) === todayISO()) return;

  const windowStart = daysAgo(7);
  const [moods, journaledDays, goalLogs, workouts, studySessions] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { userId: user.id, date: { gte: windowStart }, mood: { not: null } },
      orderBy: { date: "desc" },
      select: { mood: true },
    }),
    prisma.journalEntry.count({ where: { userId: user.id, date: { gte: windowStart }, bodyText: { not: "" } } }),
    prisma.goalLog.count({ where: { goal: { userId: user.id }, completed: true, date: { gte: windowStart } } }),
    prisma.workout.count({ where: { userId: user.id, endedAt: { not: null }, date: { gte: windowStart } } }),
    prisma.studySession.findMany({
      where: { userId: user.id, endedAt: { not: null }, startedAt: { gte: windowStart } },
      select: { durationMinutes: true },
    }),
  ]);
  const studyMinutes = studySessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  let text: string;
  try {
    text = await generatePersonalizedPrompt({
      recentMoods: moods.map((m) => m.mood).filter((m): m is number => m != null),
      journaledDaysThisWeek: journaledDays,
      goalsCompletedThisWeek: goalLogs,
      workoutsThisWeek: workouts,
      studyMinutesThisWeek: studyMinutes,
    });
  } catch (err) {
    // No ANTHROPIC_API_KEY, a rate limit, a network blip — the home page
    // already has the fixed prompt-of-the-day as its fallback, so this
    // just quietly skips the upgrade rather than surfacing an error.
    console.error("Failed to generate personalized prompt:", err);
    return;
  }
  if (!text) return;

  await prisma.user.update({ where: { id: user.id }, data: { personalizedPromptDate: new Date(), personalizedPromptText: text } });
  revalidatePath("/");
}

// Anything older just drops out of the bell/badges entirely (not deleted —
// the underlying like/comment/follow-request still exists and still shows
// up wherever that data actually lives, e.g. old follow requests on
// /friends) — a 3-day-old "so-and-so liked your post" sitting unread
// forever is more clutter than signal at this point. Matches
// (main)/layout.tsx's own NOTIFICATION_WINDOW_DAYS for the badge counts.
const NOTIFICATION_WINDOW_DAYS = 3;

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
  const windowStart = daysAgo(NOTIFICATION_WINDOW_DAYS);

  const [incoming, cheers, myWorkouts, myStudySessions] = await Promise.all([
    prisma.follow.findMany({
      where: { followingId: user.id, status: "PENDING", createdAt: { gte: windowStart } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { follower: { select: { name: true, username: true, avatarUrl: true } } },
    }),
    prisma.cheer.findMany({
      where: { toUserId: user.id, createdAt: { gte: windowStart } },
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
            createdAt: { gte: windowStart },
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

  // Only advance the seen cursor past everything in the window when we're
  // sure we actually displayed everything in it — hitting the `take` cap
  // means there could be older likes/comments still sitting beyond the 15
  // shown, and advancing to "now" would mark those as seen despite never
  // showing them, permanently dropping them from the unseen count. Leaving
  // the cursor where it was in that case just means the badge stays up
  // (over-notifying), which is the safe failure mode, not under-notifying.
  const seenUpdate: { likesSeenAt?: Date; commentsSeenAt?: Date } = {};
  if (cheers.length < 15) seenUpdate.likesSeenAt = new Date();
  if (comments.length < 15) seenUpdate.commentsSeenAt = new Date();
  if (Object.keys(seenUpdate).length > 0) {
    await prisma.user.update({ where: { id: user.id }, data: seenUpdate });
  }

  return { followRequests, activity };
}
