import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, isoToDate } from "@/lib/dates";
import { MoodCheckInModal } from "./MoodCheckInModal";
import { Sidebar } from "@/components/Sidebar";
import { levelForXp } from "@/lib/xp";
import { AchievementWatcher } from "./AchievementWatcher";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const today = todayISO();
  const [todayEntry, badges, unreadMessageCount, pendingFollowRequestCount, unseenLikesCount] = await Promise.all([
    prisma.journalEntry.findUnique({
      where: { userId_date: { userId: user.id, date: isoToDate(today) } },
      select: { mood: true },
    }),
    prisma.userBadge.findMany({ where: { userId: user.id }, select: { badge: true, earnedAt: true } }),
    prisma.message.count({ where: { recipientId: user.id, readAt: null } }),
    prisma.follow.count({ where: { followingId: user.id, status: "PENDING" } }),
    prisma.cheer.count({ where: { toUserId: user.id, createdAt: { gt: user.likesSeenAt ?? new Date(0) } } }),
  ]);
  const { level } = levelForXp(user.xp);

  return (
    <div className="flex min-h-screen">
      {todayEntry?.mood == null && <MoodCheckInModal dateISO={today} />}
      <AchievementWatcher
        badges={badges.map((b) => ({ badge: b.badge, earnedAtMs: b.earnedAt.getTime() }))}
        level={level}
      />
      <Sidebar
        level={level}
        unreadMessageCount={unreadMessageCount}
        friendsNotificationCount={pendingFollowRequestCount + unseenLikesCount}
      />
      {/* pt-14 clears the fixed mobile top bar Sidebar renders below sm —
          it's out of normal flow, so this is the only thing that would
          otherwise account for its height. */}
      <div className="min-w-0 flex-1 pt-14 sm:pt-0">
        <main className="mx-auto w-full max-w-3xl px-4 py-10">{children}</main>
      </div>
    </div>
  );
}
