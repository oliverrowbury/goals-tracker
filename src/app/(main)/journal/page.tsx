import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, isoToDate, shiftISO, formatLong } from "@/lib/dates";
import { isGoalDueOn, weekRangeContaining } from "@/lib/goals";
import { JournalEditor } from "./JournalEditor";
import { GoalsForDay, type DayGoal } from "./GoalsForDay";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const dateISO = date ?? todayISO();
  const isToday = dateISO === todayISO();

  const user = await getCurrentUser();
  const entry = await prisma.journalEntry.findUnique({
    where: { userId_date: { userId: user.id, date: isoToDate(dateISO) } },
  });

  const allGoals = await prisma.goal.findMany({
    where: { userId: user.id, active: true },
    include: { logs: true },
  });

  const dayGoals: DayGoal[] = allGoals
    .filter((goal) => isGoalDueOn(goal, dateISO))
    .map((goal) => {
      const todayLog = goal.logs.find((l) => l.date.toISOString().slice(0, 10) === dateISO);

      let weekTotal: number | null = null;
      if (goal.frequencyType === "WEEKLY_TARGET") {
        const { startISO, endISO } = weekRangeContaining(dateISO);
        weekTotal = goal.logs
          .filter((l) => {
            const d = l.date.toISOString().slice(0, 10);
            return d >= startISO && d <= endISO;
          })
          .reduce((sum, l) => sum + (l.value ?? 0), 0);
      }

      return {
        id: goal.id,
        title: goal.title,
        frequencyType: goal.frequencyType,
        unit: goal.unit,
        targetValue: goal.targetValue,
        completed: todayLog?.completed ?? false,
        value: todayLog?.value ?? null,
        weekTotal,
      };
    });

  const prevISO = shiftISO(dateISO, -1);
  const nextISO = shiftISO(dateISO, 1);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">{formatLong(dateISO)}</h1>
          {isToday && <p className="text-sm text-accent">Today</p>}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/journal?date=${prevISO}`} className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent">
            ← Prev
          </Link>
          {!isToday && (
            <Link href="/journal" className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent">
              Today
            </Link>
          )}
          <Link href={`/journal?date=${nextISO}`} className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent">
            Next →
          </Link>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-ink-muted">Goals</h2>
        <GoalsForDay dateISO={dateISO} goals={dayGoals} />
      </div>

      <JournalEditor dateISO={dateISO} initialText={entry?.bodyText ?? ""} />
    </div>
  );
}
