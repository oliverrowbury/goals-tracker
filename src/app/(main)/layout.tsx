import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, isoToDate } from "@/lib/dates";
import { WELCOME_COOKIE } from "@/lib/auth";
import { MoodCheckInModal } from "./MoodCheckInModal";
import { VerifyEmailBanner } from "./VerifyEmailBanner";
import { NotificationBell } from "./NotificationBell";
import { Sidebar } from "@/components/Sidebar";
import { levelForXp } from "@/lib/xp";
import { AchievementWatcher } from "./AchievementWatcher";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const today = todayISO();
  // Read (not cleared) — see WELCOME_COOKIE's comment in lib/auth.ts for
  // why its own short maxAge is what makes this safely one-time.
  const justLoggedIn = !!(await cookies()).get(WELCOME_COOKIE)?.value;
  const [todayEntry, badges, unreadMessageCount, pendingFollowRequestCount, unseenLikesCount, myWorkoutIds, myStudySessionIds] =
    await Promise.all([
      prisma.journalEntry.findUnique({
        where: { userId_date: { userId: user.id, date: isoToDate(today) } },
        select: { mood: true },
      }),
      prisma.userBadge.findMany({ where: { userId: user.id }, select: { badge: true, earnedAt: true } }),
      prisma.message.count({ where: { recipientId: user.id, readAt: null } }),
      prisma.follow.count({ where: { followingId: user.id, status: "PENDING" } }),
      prisma.cheer.count({ where: { toUserId: user.id, createdAt: { gt: user.likesSeenAt ?? new Date(0) } } }),
      // Comment has no direct "post owner" column (see schema.prisma's own
      // note on why), so "comments on my posts" needs my own post ids
      // first — fetched here so the count query below can run off them.
      prisma.workout.findMany({ where: { userId: user.id }, select: { id: true } }),
      prisma.studySession.findMany({ where: { userId: user.id }, select: { id: true } }),
    ]);
  const workoutIds = myWorkoutIds.map((w) => w.id);
  const studySessionIds = myStudySessionIds.map((s) => s.id);
  const unseenCommentsCount =
    workoutIds.length > 0 || studySessionIds.length > 0
      ? await prisma.comment.count({
          where: {
            authorId: { not: user.id },
            createdAt: { gt: user.commentsSeenAt ?? new Date(0) },
            OR: [{ workoutId: { in: workoutIds } }, { studySessionId: { in: studySessionIds } }],
          },
        })
      : 0;
  const { level } = levelForXp(user.xp);
  const notificationCount = pendingFollowRequestCount + unseenLikesCount + unseenCommentsCount;

  return (
    <div className="flex min-h-screen">
      {todayEntry?.mood == null && <MoodCheckInModal dateISO={today} delayed={justLoggedIn} />}
      <AchievementWatcher
        badges={badges.map((b) => ({ badge: b.badge, earnedAtMs: b.earnedAt.getTime() }))}
        level={level}
      />
      <Sidebar
        level={level}
        unreadMessageCount={unreadMessageCount}
        friendsNotificationCount={pendingFollowRequestCount + unseenLikesCount}
        notificationBell={<NotificationBell initialCount={notificationCount} />}
      />
      {/* pt-14 clears the fixed mobile top bar Sidebar renders below sm —
          it's out of normal flow, so this is the only thing that would
          otherwise account for its height. Sidebar sits outside this div
          deliberately — a transform on an ancestor of Sidebar's fixed
          mobile top bar would break its fixed-to-viewport positioning for
          the run of the animation, so only the content pane slides, not
          the nav chrome around it. */}
      <div className="min-w-0 flex-1 pt-14 sm:pt-0">
        {/* Desktop-only equivalent of the bell's mobile top-bar slot — sits
            in normal flow (not fixed), so it pushes the page below it down
            instead of floating over whatever that page puts in its own
            top-right corner (most pages' own "← back" link included, which
            a fixed-position bell here used to sit right on top of). */}
        <div className="hidden justify-end border-b border-line bg-card px-6 py-2.5 sm:flex">
          <NotificationBell initialCount={notificationCount} />
        </div>
        <main
          className={`mx-auto w-full max-w-3xl px-4 py-10 ${
            justLoggedIn ? "animate-[page-slide-in_480ms_cubic-bezier(0.16,1,0.3,1)_both]" : ""
          }`}
        >
          {!user.emailVerifiedAt && <VerifyEmailBanner />}
          {children}
        </main>
      </div>
    </div>
  );
}
