import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { SignOutIcon } from "@/components/Icons";
import { NavLinks } from "@/components/NavLinks";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, isoToDate } from "@/lib/dates";
import { MoodCheckInModal } from "./MoodCheckInModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { levelForXp } from "@/lib/xp";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const today = todayISO();
  const todayEntry = await prisma.journalEntry.findUnique({
    where: { userId_date: { userId: user.id, date: isoToDate(today) } },
    select: { mood: true },
  });
  const { level } = levelForXp(user.xp);

  return (
    <div className="flex min-h-screen flex-col">
      {todayEntry?.mood == null && <MoodCheckInModal dateISO={today} />}
      <header className="border-b border-line bg-card/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="shrink-0 text-base text-ink transition-transform hover:scale-[1.02] sm:text-2xl">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-0.5 text-sm text-ink-muted">
            <NavLinks />
            <Link
              href="/settings"
              title={`Level ${level} — see your XP and streaks`}
              className="ml-1 mr-0.5 hidden shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent hover:opacity-80 sm:inline-block"
            >
              Lv {level}
            </Link>
            <form action="/api/logout" method="POST" className="flex">
              <button type="submit" title="Sign out" className="flex items-center p-2 -m-0.5 hover:text-accent">
                <SignOutIcon className="h-5 w-5" />
              </button>
            </form>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
    </div>
  );
}
