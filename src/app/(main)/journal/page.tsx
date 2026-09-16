import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, isoToDate, shiftISO, formatLong, monthISOOf, monthRangeContaining, dateToISO, isFutureISO } from "@/lib/dates";
import { isGoalDueOn, weekRangeContaining } from "@/lib/goals";
import { formatMinutes } from "@/lib/study";
import { JournalEditor } from "./JournalEditor";
import { GoalsForDay, type DayGoal } from "./GoalsForDay";
import { MoodPicker } from "./MoodPicker";
import { MoodChart } from "./MoodChart";
import { PhotoUpload } from "./PhotoUpload";
import { Flashbacks } from "./Flashbacks";
import { JournalIcon } from "@/components/Icons";
import { deleteStudySession } from "../study/actions";
import { PageHeader } from "@/components/PageHeader";
import { NavPill } from "@/components/NavPill";

// How many years back to look for "on this day" flashbacks.
const FLASHBACK_YEARS = 8;

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const today = todayISO();
  const dateISO = date ?? today;
  // A future day hasn't happened yet, so there's nothing to log against it
  // — bounce back to today rather than letting mood/goals/journal be filled
  // in ahead of time.
  if (isFutureISO(dateISO)) redirect("/journal");
  const isToday = dateISO === today;
  const isPast = !isToday;

  const user = await getCurrentUser();
  const { startISO: weekStartISO, endISO: weekEndISO } = weekRangeContaining(dateISO);
  const monthISO = monthISOOf(dateISO);
  const { startISO: monthStartISO, endISO: monthEndISO } = monthRangeContaining(dateISO);

  const flashbackDates = Array.from({ length: FLASHBACK_YEARS }, (_, i) => {
    const d = isoToDate(dateISO);
    d.setUTCFullYear(d.getUTCFullYear() - (i + 1));
    return dateToISO(d);
  }).filter((d) => monthISOOf(d).slice(5) === dateISO.slice(5, 7)); // guard against Feb 29 rolling into March

  const [entry, allGoals, weekStudySessions, weekWorkouts, subjects, monthEntries, flashbackEntries] = await Promise.all([
    prisma.journalEntry.findUnique({ where: { userId_date: { userId: user.id, date: isoToDate(dateISO) } } }),
    prisma.goal.findMany({ where: { userId: user.id, active: true }, include: { logs: true } }),
    prisma.studySession.findMany({
      where: {
        userId: user.id,
        endedAt: { not: null },
        startedAt: { gte: new Date(`${weekStartISO}T00:00:00.000Z`), lte: new Date(`${weekEndISO}T23:59:59.999Z`) },
      },
    }),
    prisma.workout.findMany({
      where: {
        userId: user.id,
        endedAt: { not: null },
        date: { gte: new Date(`${weekStartISO}T00:00:00.000Z`), lte: new Date(`${weekEndISO}T23:59:59.999Z`) },
      },
      select: { durationMinutes: true },
    }),
    prisma.subject.findMany({ where: { userId: user.id } }),
    prisma.journalEntry.findMany({
      where: { userId: user.id, date: { gte: isoToDate(monthStartISO), lte: isoToDate(monthEndISO) } },
      select: { date: true, mood: true },
    }),
    prisma.journalEntry.findMany({
      where: { userId: user.id, date: { in: flashbackDates.map(isoToDate) } },
      select: { date: true, bodyText: true, photoUrl: true },
    }),
  ]);

  const flashbacks = flashbackEntries
    .filter((e) => e.bodyText.trim() || e.photoUrl)
    .map((e) => {
      const fDateISO = dateToISO(e.date);
      return {
        dateISO: fDateISO,
        yearsAgo: Number(dateISO.slice(0, 4)) - Number(fDateISO.slice(0, 4)),
        bodyText: e.bodyText,
        photoUrl: e.photoUrl,
      };
    })
    .sort((a, b) => a.yearsAgo - b.yearsAgo);

  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const weekMinutesBySubject = new Map<string, number>();
  for (const session of weekStudySessions) {
    weekMinutesBySubject.set(
      session.subjectId,
      (weekMinutesBySubject.get(session.subjectId) ?? 0) + (session.durationMinutes ?? 0),
    );
  }

  const todaysStudySessions = weekStudySessions.filter((s) => s.startedAt.toISOString().slice(0, 10) === dateISO);

  const weekWorkoutSessionCount = weekWorkouts.length;
  const weekWorkoutMinutes = weekWorkouts.reduce((sum, w) => sum + (w.durationMinutes ?? 0), 0);

  const dayGoals: DayGoal[] = allGoals
    .filter((goal) => isGoalDueOn(goal, dateISO))
    .map((goal) => {
      const todayLog = goal.logs.find((l) => l.date.toISOString().slice(0, 10) === dateISO);
      // Auto-tracked from Study (subjectId) or Workouts (workoutMetric) — but
      // still allows a manual top-up below (see setGoalLogValue), in case the
      // auto-tracked source missed something (forgot to use the timer, etc).
      const isAutoTracked = goal.frequencyType === "WEEKLY_TARGET" && !!(goal.subjectId || goal.workoutMetric);

      let weekTotal: number | null = null;
      if (goal.frequencyType === "WEEKLY_TARGET") {
        const autoPart = goal.subjectId
          ? (weekMinutesBySubject.get(goal.subjectId) ?? 0)
          : goal.workoutMetric === "SESSIONS"
            ? weekWorkoutSessionCount
            : goal.workoutMetric === "MINUTES"
              ? weekWorkoutMinutes
              : 0;
        const manualPart = goal.logs
          .filter((l) => {
            const d = l.date.toISOString().slice(0, 10);
            return d >= weekStartISO && d <= weekEndISO;
          })
          .reduce((sum, l) => sum + (l.value ?? 0), 0);
        weekTotal = autoPart + manualPart;
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
      <PageHeader
        icon={JournalIcon}
        title={formatLong(dateISO)}
        subtitle={isToday && <p className="text-sm text-accent">Today</p>}
        align="baseline"
        className="mb-8"
        right={
          <div className="flex items-center gap-2">
            {isPast && <NavPill href="/calendar">← Calendar</NavPill>}
            <NavPill href={`/journal?date=${prevISO}`}>← Prev</NavPill>
            {isPast && <NavPill href="/journal">Today</NavPill>}
            {isPast && <NavPill href={`/journal?date=${nextISO}`}>Next →</NavPill>}
          </div>
        }
      />

      <Flashbacks flashbacks={flashbacks} />

      <MoodPicker dateISO={dateISO} initialMood={entry?.mood ?? null} />

      <div className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-ink-muted">Goals</h2>
        <GoalsForDay dateISO={dateISO} goals={dayGoals} />
      </div>

      {todaysStudySessions.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Studied</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {todaysStudySessions.map((session) => {
              const subject = subjectById.get(session.subjectId);
              return (
                <li key={session.id} className="flex items-center gap-2 px-3.5 py-2 text-sm text-ink">
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

      <PhotoUpload dateISO={dateISO} initialPhotoUrl={entry?.photoUrl ?? null} />

      <JournalEditor dateISO={dateISO} initialText={entry?.bodyText ?? ""} initialImproveText={entry?.improveText ?? ""} />

      <div className="mt-8">
        <MoodChart monthISO={monthISO} entries={monthEntries.map((e) => ({ dateISO: dateToISO(e.date), mood: e.mood }))} today={today} />
      </div>
    </div>
  );
}
