import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, isoToDate, shiftISO, formatLong, monthISOOf, monthRangeContaining, dateToISO } from "@/lib/dates";
import { isGoalDueOn, weekRangeContaining } from "@/lib/goals";
import { formatMinutes } from "@/lib/study";
import { promptForDate } from "@/lib/prompts";
import { JournalEditor } from "./JournalEditor";
import { GoalsForDay, type DayGoal } from "./GoalsForDay";
import { MoodPicker } from "./MoodPicker";
import { MoodChart } from "./MoodChart";
import { PhotoUpload } from "./PhotoUpload";
import { Flashbacks } from "./Flashbacks";
import { JournalIcon } from "@/components/Icons";
import { deleteStudySession } from "../study/actions";

// How many years back to look for "on this day" flashbacks.
const FLASHBACK_YEARS = 8;

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
  const monthISO = monthISOOf(dateISO);
  const { startISO: monthStartISO, endISO: monthEndISO } = monthRangeContaining(dateISO);

  const flashbackDates = Array.from({ length: FLASHBACK_YEARS }, (_, i) => {
    const d = isoToDate(dateISO);
    d.setUTCFullYear(d.getUTCFullYear() - (i + 1));
    return dateToISO(d);
  }).filter((d) => monthISOOf(d).slice(5) === dateISO.slice(5, 7)); // guard against Feb 29 rolling into March

  const [entry, allGoals, weekStudySessions, subjects, monthEntries, flashbackEntries] = await Promise.all([
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
        <div className="flex items-baseline gap-2.5">
          <JournalIcon className="h-5 w-5 shrink-0 translate-y-0.5 text-accent" />
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

      <Flashbacks flashbacks={flashbacks} />

      <MoodPicker dateISO={dateISO} initialMood={entry?.mood ?? null} />

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

      <PhotoUpload dateISO={dateISO} initialPhotoUrl={entry?.photoUrl ?? null} />

      <JournalEditor
        dateISO={dateISO}
        initialText={entry?.bodyText ?? ""}
        initialImproveText={entry?.improveText ?? ""}
        initialPromptResponse={entry?.promptResponse ?? ""}
        prompt={promptForDate(dateISO)}
      />

      <div className="mt-8">
        <MoodChart monthISO={monthISO} entries={monthEntries.map((e) => ({ dateISO: dateToISO(e.date), mood: e.mood }))} />
      </div>
    </div>
  );
}
