import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { JournalIcon, TargetIcon, ClockIcon, GearIcon, CalendarIcon } from "@/components/Icons";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-card/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg text-ink">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-5 text-sm text-ink-muted">
            <Link href="/journal" className="flex items-center gap-1.5 hover:text-accent">
              <JournalIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Journal</span>
            </Link>
            <Link href="/goals" className="flex items-center gap-1.5 hover:text-goals">
              <TargetIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Goals</span>
            </Link>
            <Link href="/study" className="flex items-center gap-1.5 hover:text-study">
              <ClockIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Study</span>
            </Link>
            <Link href="/calendar" className="flex items-center gap-1.5 hover:text-ink">
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </Link>
            <Link href="/settings" className="flex items-center gap-1.5 hover:text-ink">
              <GearIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            <form action="/api/logout" method="POST">
              <button type="submit" className="hover:text-accent">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
    </div>
  );
}
