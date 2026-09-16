import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, monthISOOf, shiftMonth, formatMonth, monthGridDays, isoToDate } from "@/lib/dates";
import { CalendarIcon } from "@/components/Icons";
import { moodFace } from "@/lib/mood";
import { PageHeader } from "@/components/PageHeader";
import { NavPill } from "@/components/NavPill";

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
      select: { date: true, bodyText: true, mood: true },
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
  const moodByDay = new Map(
    entries.filter((e) => e.mood != null).map((e) => [e.date.toISOString().slice(0, 10), e.mood as number]),
  );

  return (
    <div>
      <PageHeader
        icon={CalendarIcon}
        iconClassName="text-ink-muted"
        title={formatMonth(monthISO)}
        right={
          <div className="flex items-center gap-2">
            <NavPill href={`/calendar?month=${shiftMonth(monthISO, -1)}`}>← Prev</NavPill>
            {monthISO !== monthISOOf(today) && <NavPill href="/calendar">This month</NavPill>}
            <NavPill href={`/calendar?month=${shiftMonth(monthISO, 1)}`}>Next →</NavPill>
          </div>
        }
      />

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
          const isFuture = dayISO > today;
          const hasJournal = journalDays.has(dayISO);
          const hasGoal = goalDays.has(dayISO);
          const hasStudy = studyDays.has(dayISO);
          const dayNum = Number(dayISO.slice(8, 10));
          const mood = moodByDay.get(dayISO);

          const dots = (hasJournal || hasGoal || hasStudy) && (
            <span className="mt-auto flex items-center gap-0.5 pb-1.5">
              {hasJournal && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              {hasGoal && <span className="h-1.5 w-1.5 rounded-full bg-goals" />}
              {hasStudy && <span className="h-1.5 w-1.5 rounded-full bg-study" />}
            </span>
          );

          // A future day has nothing to show and nothing to log yet — render
          // it as a plain, unclickable cell rather than a link into a day
          // that doesn't make sense to open.
          if (isFuture) {
            return (
              <div
                key={dayISO}
                className={`flex aspect-square flex-col items-center gap-1 rounded-xl border pt-2 text-sm ${
                  inMonth ? "border-transparent text-ink-muted/40" : "border-transparent text-ink-muted/20"
                }`}
              >
                <span>{dayNum}</span>
              </div>
            );
          }

          return (
            <Link
              key={dayISO}
              href={`/journal?date=${dayISO}`}
              className={`flex aspect-square flex-col items-center gap-1 rounded-xl border pt-2 text-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md ${
                inMonth ? "border-line bg-card" : "border-transparent text-ink-muted/50"
              } ${isToday ? "ring-2 ring-accent ring-offset-1 ring-offset-paper" : ""}`}
            >
              <span className={inMonth ? "text-ink" : "text-ink-muted/50"}>{dayNum}</span>
              {mood != null && <span className="text-base leading-none">{moodFace(mood)}</span>}
              {dots}
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
