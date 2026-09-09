import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, monthISOOf, shiftMonth, formatMonth, monthGridDays, isoToDate } from "@/lib/dates";
import { CalendarIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const today = todayISO();
  const monthISO = month ?? monthISOOf(today);

  const days = monthGridDays(monthISO);
  const gridStartISO = days[0];
  const gridEndISO = days[days.length - 1];

  const user = await getCurrentUser();
  const rangeStart = isoToDate(gridStartISO);
  const rangeEnd = new Date(`${gridEndISO}T23:59:59.999Z`);

  const [entries, goalLogs, sessions] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { userId: user.id, date: { gte: rangeStart, lte: rangeEnd } },
      select: { date: true, bodyText: true },
    }),
    prisma.goalLog.findMany({
      where: { completed: true, date: { gte: rangeStart, lte: rangeEnd }, goal: { userId: user.id } },
      select: { date: true },
    }),
    prisma.studySession.findMany({
      where: { userId: user.id, endedAt: { not: null }, startedAt: { gte: rangeStart, lte: rangeEnd } },
      select: { startedAt: true },
    }),
  ]);

  const journalDays = new Set(
    entries.filter((e) => e.bodyText.trim() !== "").map((e) => e.date.toISOString().slice(0, 10)),
  );
  const goalDays = new Set(goalLogs.map((g) => g.date.toISOString().slice(0, 10)));
  const studyDays = new Set(sessions.map((s) => s.startedAt.toISOString().slice(0, 10)));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-line/60 text-ink">
            <CalendarIcon className="h-4.5 w-4.5" />
          </span>
          <h1 className="font-serif text-2xl font-semibold text-ink">{formatMonth(monthISO)}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/calendar?month=${shiftMonth(monthISO, -1)}`}
            className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent"
          >
            ← Prev
          </Link>
          {monthISO !== monthISOOf(today) && (
            <Link href="/calendar" className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent">
              This month
            </Link>
          )}
          <Link
            href={`/calendar?month=${shiftMonth(monthISO, 1)}`}
            className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-ink-muted">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="pb-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((dayISO) => {
          const inMonth = monthISOOf(dayISO) === monthISO;
          const isToday = dayISO === today;
          const hasJournal = journalDays.has(dayISO);
          const hasGoal = goalDays.has(dayISO);
          const hasStudy = studyDays.has(dayISO);
          const dayNum = Number(dayISO.slice(8, 10));

          return (
            <Link
              key={dayISO}
              href={`/journal?date=${dayISO}`}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-sm transition hover:border-accent ${
                inMonth ? "border-line bg-card" : "border-transparent text-ink-muted/50"
              } ${isToday ? "ring-2 ring-accent ring-offset-1 ring-offset-paper" : ""}`}
            >
              <span className={inMonth ? "text-ink" : "text-ink-muted/50"}>{dayNum}</span>
              {(hasJournal || hasGoal || hasStudy) && (
                <span className="flex items-center gap-0.5">
                  {hasJournal && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  {hasGoal && <span className="h-1.5 w-1.5 rounded-full bg-goals" />}
                  {hasStudy && <span className="h-1.5 w-1.5 rounded-full bg-study" />}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" /> Journaled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-goals" /> Goal done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-study" /> Studied
        </span>
      </div>
    </div>
  );
}
