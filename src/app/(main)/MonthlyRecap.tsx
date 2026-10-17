import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { todayISO, shiftISO, isoToDate, daysBetween, monthISOOf, shiftMonth, formatMonth, monthRangeContaining } from "@/lib/dates";
import { isGoalDueOn } from "@/lib/goals";
import { formatMinutes } from "@/lib/study";
import { formatDistance } from "@/lib/workout";
import { ChartIcon } from "@/components/Icons";
import type { DistanceUnit } from "@/lib/constants";

type GoalSummary = { id: string; title: string; hit: boolean; detail: string };

export type MonthlyRecapData = {
  monthISO: string;
  startISO: string;
  endISO: string;
  isCurrentMonth: boolean;
  goalSummaries: GoalSummary[];
  subjectMinutes: { subjectId: string; name: string; color: string; minutes: number }[];
  totalMinutes: number;
  workoutSessionCount: number;
  workoutMinutes: number;
  cardioKm: number;
};

// Mirrors getWeeklyRecapData (see WeeklyRecap.tsx) but rolled up over a
// full calendar month instead of a week — fetched alongside the rest of
// the home page's data in the same Promise.all for the same reason: a
// nested async Server Component only starts fetching once the parent's
// function body finishes, not in parallel with it.
export async function getMonthlyRecapData(userId: string, anchorMonthISO: string): Promise<MonthlyRecapData> {
  const monthISO = anchorMonthISO;
  const { startISO, endISO } = monthRangeContaining(`${monthISO}-01`);
  const today = todayISO();
  const dayCount = daysBetween(startISO, endISO) + 1;
  const days = Array.from({ length: dayCount }, (_, i) => shiftISO(startISO, i));
  const weeksInMonth = dayCount / 7;

  const rangeStart = isoToDate(startISO);
  const rangeEnd = new Date(`${endISO}T23:59:59.999Z`);

  const [goals, sessions, subjects, workouts] = await Promise.all([
    prisma.goal.findMany({ where: { userId, active: true }, include: { logs: true } }),
    prisma.studySession.findMany({
      where: { userId, endedAt: { not: null }, startedAt: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.subject.findMany({ where: { userId } }),
    prisma.workout.findMany({
      where: { userId, endedAt: { not: null }, date: { gte: rangeStart, lte: rangeEnd } },
    }),
  ]);

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const minutesBySubject = new Map<string, number>();
  for (const session of sessions) {
    minutesBySubject.set(session.subjectId, (minutesBySubject.get(session.subjectId) ?? 0) + (session.durationMinutes ?? 0));
  }
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  const workoutSessionCount = workouts.length;
  const workoutMinutes = workouts.reduce((sum, w) => sum + (w.durationMinutes ?? 0), 0);
  const cardioKm = workouts.reduce((sum, w) => sum + (w.distanceKm ?? 0), 0);

  const goalSummaries = goals
    .map((goal) => {
      if (goal.frequencyType === "WEEKLY_TARGET") {
        const autoPart = goal.subjectId
          ? (minutesBySubject.get(goal.subjectId) ?? 0)
          : goal.workoutMetric === "SESSIONS"
            ? workoutSessionCount
            : goal.workoutMetric === "MINUTES"
              ? workoutMinutes
              : 0;
        const manualPart = goal.logs
          .filter((l) => days.includes(l.date.toISOString().slice(0, 10)))
          .reduce((sum, l) => sum + (l.value ?? 0), 0);
        const total = autoPart + manualPart;
        // The goal's target is defined per week — scaled up by how many
        // weeks are in this month for a rough monthly equivalent, since
        // there's no separate monthly target to compare against.
        const monthlyTarget = Math.round((goal.targetValue ?? 0) * weeksInMonth);
        return {
          id: goal.id,
          title: goal.title,
          hit: total >= monthlyTarget,
          detail: `${total}/${monthlyTarget} ${goal.unit ?? ""} this month`,
        };
      }
      const dueDays = days.filter((d) => isGoalDueOn(goal, d) && d <= today);
      if (dueDays.length === 0) return null;
      const completedDates = new Set(goal.logs.filter((l) => l.completed).map((l) => l.date.toISOString().slice(0, 10)));
      const doneCount = dueDays.filter((d) => completedDates.has(d)).length;
      return { id: goal.id, title: goal.title, hit: doneCount === dueDays.length, detail: `${doneCount}/${dueDays.length} days` };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  const subjectMinutes = Array.from(minutesBySubject.entries())
    .map(([subjectId, minutes]) => ({
      subjectId,
      name: subjectById.get(subjectId)?.name ?? "Unknown subject",
      color: subjectById.get(subjectId)?.color ?? "#999",
      minutes,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    monthISO,
    startISO,
    endISO,
    isCurrentMonth: monthISO === monthISOOf(today),
    goalSummaries,
    subjectMinutes,
    totalMinutes,
    workoutSessionCount,
    workoutMinutes,
    cardioKm,
  };
}

export function MonthlyRecap({
  data,
  distanceUnit,
  isPremium,
}: {
  data: MonthlyRecapData;
  distanceUnit: DistanceUnit;
  isPremium?: boolean;
}) {
  const { monthISO, isCurrentMonth, goalSummaries, subjectMinutes, totalMinutes, workoutSessionCount, workoutMinutes, cardioKm } = data;

  return (
    <div id="monthly-recap" className="mt-10 scroll-mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2.5">
          <ChartIcon className="h-5 w-5 shrink-0 text-ink-muted" />
          <h2 className="font-serif text-xl font-semibold text-ink">{formatMonth(monthISO)}</h2>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {isPremium && (
            <a
              href={`/api/export/recap/monthly?month=${monthISO}`}
              className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent"
            >
              📄 PDF
            </a>
          )}
          <Link
            href={`/?month=${shiftMonth(monthISO, -1)}`}
            className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent"
          >
            ← Prev
          </Link>
          {!isCurrentMonth && (
            <Link href="/" className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent">
              This month
            </Link>
          )}
          <Link
            href={`/?month=${shiftMonth(monthISO, 1)}`}
            className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="divide-y divide-line rounded-2xl border border-line bg-card shadow-sm">
        <section className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-goals" /> Goals
          </h3>
          {goalSummaries.length === 0 ? (
            <p className="text-sm text-ink-muted">No goals due this month.</p>
          ) : (
            <ul className="-mx-5 divide-y divide-line">
              {goalSummaries.map((g) => (
                <li key={g.id} className="flex items-center justify-between px-5 py-2 text-sm">
                  <span className={g.hit ? "text-ink" : "text-ink-muted"}>{g.title}</span>
                  <span className={g.hit ? "font-medium text-goals" : "text-ink-muted"}>{g.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-study" /> Study time
          </h3>
          {subjectMinutes.length === 0 ? (
            <p className="text-sm text-ink-muted">No study time logged this month.</p>
          ) : (
            <>
              <ul className="-mx-5 divide-y divide-line">
                {subjectMinutes.map((s) => (
                  <li key={s.subjectId} className="flex items-center justify-between px-5 py-2 text-sm">
                    <span className="flex items-center gap-2 text-ink">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <span className="text-ink-muted">{formatMinutes(s.minutes)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-muted">{formatMinutes(totalMinutes)} total this month</p>
            </>
          )}
        </section>

        <section className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-workout" /> Workouts
          </h3>
          {workoutSessionCount === 0 ? (
            <p className="text-sm text-ink-muted">No workouts logged this month.</p>
          ) : (
            <p className="text-sm text-ink">
              {workoutSessionCount} session{workoutSessionCount === 1 ? "" : "s"} · {formatMinutes(workoutMinutes)} total
              {cardioKm > 0 && ` · ${formatDistance(cardioKm, distanceUnit)} covered`}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
