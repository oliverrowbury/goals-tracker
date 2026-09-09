import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, isoToDate, shiftISO, formatLong } from "@/lib/dates";
import { isGoalDueOn, weekRangeContaining } from "@/lib/goals";
import { formatMinutes } from "@/lib/study";
import { JournalEditor } from "./JournalEditor";
import { GoalsForDay, type DayGoal } from "./GoalsForDay";
import { JournalIcon } from "@/components/Icons";
import { deleteStudySession } from "../study/actions";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const dateISO = date ?? todayISO();
  const isToday = dateISO === todayISO();

  const user = await getCurrentUser();
  const { startISO: weekStartISO, endISO: weekEndISO } = weekRangeContaining(dateISO);

  const [entry, allGoals, weekStudySessions, subjects] = await Promise.all([
    prisma.journalEntry.findUnique({ where: { userId_date: { userId: user.id, date: isoToDate(dateISO) } } }),
    prisma.goal.findMany({ where: { userId: user.id, active: true }, include: { logs: true } }),
    prisma.studySession.findMany({
      where: {
        userId: user.id,
        endedAt: { not: null },
        startedAt: { gte: new Date(`${weekStartISO}T00:00:00.000Z`), lte: new Date(`${weekEndISO}T23:59:59.999Z`) },
      },
    }),
    prisma.subject.findMany({ where: { userId: user.id } }),
  ]);

  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const weekMinutesBySubject = new Map<string, number>();
  for (const session of weekStudySessions) {
    weekMinutesBySubject.set(
      session.subjectId,
      (weekMinutesBySubject.get(session.subjectId) ?? 0) + (session.durationMinutes ?? 0),
    );
  }

  const todaysStudySessions = weekStudySessions.filter((s) => s.startedAt.toISOString().slice(0, 10) === dateISO);

  const dayGoals: DayGoal[] = allGoals
    .filter((goal) => isGoalDueOn(goal, dateISO))
    .map((goal) => {
      const todayLog = goal.logs.find((l) => l.date.toISOString().slice(0, 10) === dateISO);
      const isAutoTracked = goal.frequencyType === "WEEKLY_TARGET" && !!goal.subjectId;

      let weekTotal: number | null = null;
      if (goal.frequencyType === "WEEKLY_TARGET") {
        weekTotal = isAutoTracked
          ? (weekMinutesBySubject.get(goal.subjectId!) ?? 0)
          : goal.logs
              .filter((l) => {
                const d = l.date.toISOString().slice(0, 10);
                return d >= weekStartISO && d <= weekEndISO;
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
        isAutoTracked,
      };
    });

  const prevISO = shiftISO(dateISO, -1);
  const nextISO = shiftISO(dateISO, 1);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
            <JournalIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-ink">{formatLong(dateISO)}</h1>
            {isToday && <p className="text-sm text-accent">Today</p>}
          </div>
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

      {todaysStudySessions.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Studied</h2>
          <ul className="space-y-1.5">
            {todaysStudySessions.map((session) => {
              const subject = subjectById.get(session.subjectId);
              return (
                <li key={session.id} className="flex items-center gap-2 rounded-lg border border-line bg-card px-3.5 py-2 text-sm text-ink">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: subject?.color ?? "#999" }} />
                  {subject?.name ?? "Unknown subject"}
                  <span className="text-ink-muted">— {formatMinutes(session.durationMinutes ?? 0)}</span>
                  <form action={deleteStudySession.bind(null, session.id)} className="ml-auto">
                    <button
                      type="submit"
                      title="Remove this session"
                      className="text-ink-muted hover:text-accent"
                    >
                      ×
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <JournalEditor dateISO={dateISO} initialText={entry?.bodyText ?? ""} />
    </div>
  );
}
