import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, isoToDate, formatLong } from "@/lib/dates";
import { isGoalDueOn, weekRangeContaining } from "@/lib/goals";
import { formatMinutes } from "@/lib/study";
import { JournalIcon, TargetIcon, ClockIcon } from "@/components/Icons";
import { promptForDate } from "@/lib/prompts";
import { PromptOfDayCard } from "./PromptOfDayCard";

export const dynamic = "force-dynamic";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const today = todayISO();
  const { startISO, endISO } = weekRangeContaining(today);

  const [entry, goals, weekSessions] = await Promise.all([
    prisma.journalEntry.findUnique({ where: { userId_date: { userId: user.id, date: isoToDate(today) } } }),
    prisma.goal.findMany({ where: { userId: user.id, active: true }, include: { logs: true } }),
    prisma.studySession.findMany({
      where: {
        userId: user.id,
        endedAt: { not: null },
        startedAt: { gte: new Date(`${startISO}T00:00:00.000Z`), lte: new Date(`${endISO}T23:59:59.999Z`) },
      },
    }),
  ]);

  const dueToday = goals.filter((g) => isGoalDueOn(g, today) && g.frequencyType !== "WEEKLY_TARGET");
  const doneToday = dueToday.filter((g) => g.logs.some((l) => l.date.toISOString().slice(0, 10) === today && l.completed));
  const weekMinutes = weekSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  const journalStatus = entry?.bodyText.trim() ? "Written today" : "Not started yet";

  return (
    <div>
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-line bg-card px-7 py-10 shadow-sm sm:px-10">
        <svg
          viewBox="0 0 48 48"
          className="pointer-events-none absolute -right-6 -top-8 h-48 w-48 text-accent opacity-[0.06] sm:h-64 sm:w-64"
          fill="none"
          aria-hidden="true"
        >
          <rect x="8" y="30" width="8" height="12" rx="1.5" fill="currentColor" />
          <rect x="20" y="20" width="8" height="22" rx="1.5" fill="currentColor" />
          <rect x="32" y="8" width="8" height="34" rx="1.5" fill="currentColor" />
        </svg>
        <p className="relative animate-[fade-up_0.5s_ease-out] text-sm font-medium text-accent">{formatLong(today)}</p>
        <h1 className="relative mt-1 max-w-md animate-[fade-up_0.5s_ease-out_0.05s_both] text-balance font-serif text-3xl font-semibold text-ink sm:text-4xl">
          {greeting()}, {user.name}.
        </h1>
        <p className="relative mt-3 max-w-md animate-[fade-up_0.5s_ease-out_0.1s_both] text-sm text-ink-muted">
          What are you proud of today?
        </p>
      </div>

      <PromptOfDayCard dateISO={today} prompt={promptForDate(today)} initialResponse={entry?.promptResponse ?? ""} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/journal"
          className="group relative animate-[fade-up_0.5s_ease-out_0.05s_both] overflow-hidden rounded-2xl border border-line bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
        >
          <span className="absolute inset-x-0 top-0 h-1 bg-accent" />
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
            <JournalIcon className="h-3.5 w-3.5 text-accent" /> Journal
          </p>
          <p className="mt-1 font-serif text-xl font-semibold text-ink">{journalStatus}</p>
          <p className="mt-3 text-sm text-accent group-hover:underline">Write today's entry →</p>
        </Link>

        <Link
          href="/goals"
          className="group relative animate-[fade-up_0.5s_ease-out_0.1s_both] overflow-hidden rounded-2xl border border-line bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-goals hover:shadow-md"
        >
          <span className="absolute inset-x-0 top-0 h-1 bg-goals" />
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
            <TargetIcon className="h-3.5 w-3.5 text-goals" /> Goals
          </p>
          <p className="mt-1 font-serif text-xl font-semibold text-ink">
            {dueToday.length === 0 ? "None due today" : `${doneToday.length} of ${dueToday.length} done`}
          </p>
          <p className="mt-3 text-sm text-goals group-hover:underline">Check today's goals →</p>
        </Link>

        <Link
          href="/study"
          className="group relative animate-[fade-up_0.5s_ease-out_0.15s_both] overflow-hidden rounded-2xl border border-line bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-study hover:shadow-md"
        >
          <span className="absolute inset-x-0 top-0 h-1 bg-study" />
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
            <ClockIcon className="h-3.5 w-3.5 text-study" /> Study
          </p>
          <p className="mt-1 font-serif text-xl font-semibold text-ink">{formatMinutes(weekMinutes)} this week</p>
          <p className="mt-3 text-sm text-study group-hover:underline">Start a session →</p>
        </Link>
      </div>
    </div>
  );
}
