import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, isoToDate } from "@/lib/dates";
import { MoodCheckInModal } from "./MoodCheckInModal";
import { Sidebar } from "@/components/Sidebar";
import { levelForXp } from "@/lib/xp";
import { BadgeWatcher } from "./BadgeWatcher";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const today = todayISO();
  const [todayEntry, badges] = await Promise.all([
    prisma.journalEntry.findUnique({
      where: { userId_date: { userId: user.id, date: isoToDate(today) } },
      select: { mood: true },
    }),
    prisma.userBadge.findMany({ where: { userId: user.id }, select: { badge: true, earnedAt: true } }),
  ]);
  const { level } = levelForXp(user.xp);

  return (
    <div className="flex min-h-screen">
      {todayEntry?.mood == null && <MoodCheckInModal dateISO={today} />}
      <BadgeWatcher badges={badges.map((b) => ({ badge: b.badge, earnedAtMs: b.earnedAt.getTime() }))} />
      <Sidebar level={level} />
      {/* pt-14 clears the fixed mobile top bar Sidebar renders below sm —
          it's out of normal flow, so this is the only thing that would
          otherwise account for its height. */}
      <div className="min-w-0 flex-1 pt-14 sm:pt-0">
        <main className="mx-auto w-full max-w-3xl px-4 py-10">{children}</main>
      </div>
    </div>
  );
}
