import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, shiftISO, isoToDate, formatWeekRange, formatLong } from "@/lib/dates";
import { weekRangeContaining, isGoalDueOn } from "@/lib/goals";
import { formatMinutes } from "@/lib/study";
import { ChartIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

function snippet(text: string, max = 90): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + "…";
}

export default async function RecapPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const anchor = date ?? todayISO();
  const { startISO, endISO } = weekRangeContaining(anchor);
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => shiftISO(startISO, i));

  const user = await getCurrentUser();
  const rangeStart = isoToDate(startISO);
  const rangeEnd = new Date(`${endISO}T23:59:59.999Z`);

  const [entries, goals, sessions, subjects] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { userId: user.id, date: { gte: rangeStart, lte: rangeEnd } },
      orderBy: { date: "asc" },
    }),
    prisma.goal.findMany({ where: { userId: user.id, active: true }, include: { logs: true } }),
    prisma.studySession.findMany({
      where: { userId: user.id, endedAt: { not: null }, startedAt: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.subject.findMany({ where: { userId: user.id } }),
  ]);

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const minutesBySubject = new Map<string, number>();
  for (const session of sessions) {
    minutesBySubject.set(session.subjectId, (minutesBySubject.get(session.subjectId) ?? 0) + (session.durationMinutes ?? 0));
  }
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  const goalSummaries = goals
    .map((goal) => {
      if (goal.frequencyType === "WEEKLY_TARGET") {
        const total = goal.subjectId
          ? (minutesBySubject.get(goal.subjectId) ?? 0)
          : goal.logs
              .filter((l) => days.includes(l.date.toISOString().slice(0, 10)))
              .reduce((sum, l) => sum + (l.value ?? 0), 0);
        return { title: goal.title, hit: total >= (goal.targetValue ?? 0), detail: `${total}/${goal.targetValue} ${goal.unit ?? ""}` };
      }
      const dueDays = days.filter((d) => isGoalDueOn(goal, d) && d <= today);
      if (dueDays.length === 0) return null;
      const completedDates = new Set(goal.logs.filter((l) => l.completed).map((l) => l.date.toISOString().slice(0, 10)));
      const doneCount = dueDays.filter((d) => completedDates.has(d)).length;
      return { title: goal.title, hit: doneCount === dueDays.length, detail: `${doneCount}/${dueDays.length} days` };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  const journaledDays = days
    .map((d) => ({ dateISO: d, entry: entries.find((e) => e.date.toISOString().slice(0, 10) === d) }))
    .filter((d) => d.entry && (d.entry.bodyText.trim() || d.entry.improveText?.trim()));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ChartIcon className="h-5 w-5 shrink-0 text-ink-muted" />
          <h1 className="font-serif text-2xl font-semibold text-ink">Week of {formatWeekRange(startISO, endISO)}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/recap?date=${shiftISO(startISO, -7)}`}
            className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent"
          >
            ← Prev
          </Link>
          {startISO !== weekRangeContaining(today).startISO && (
            <Link href="/recap" className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent">
              This week
            </Link>
          )}
          <Link
            href={`/recap?date=${shiftISO(endISO, 1)}`}
            className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-accent hover:text-accent"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-goals" /> Goals
          </h2>
          {goalSummaries.length === 0 ? (
            <p className="text-sm text-ink-muted">No goals due this week.</p>
          ) : (
            <ul className="-mx-5 divide-y divide-line">
              {goalSummaries.map((g) => (
                <li key={g.title} className="flex items-center justify-between px-5 py-2 text-sm">
                  <span className={g.hit ? "text-ink" : "text-ink-muted"}>{g.title}</span>
                  <span className={g.hit ? "font-medium text-goals" : "text-ink-muted"}>{g.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-study" /> Study time
          </h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-ink-muted">No study time logged this week.</p>
          ) : (
            <>
              <ul className="-mx-5 divide-y divide-line">
                {Array.from(minutesBySubject.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([subjectId, minutes]) => (
                    <li key={subjectId} className="flex items-center justify-between px-5 py-2 text-sm">
                      <span className="flex items-center gap-2 text-ink">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subjectById.get(subjectId)?.color ?? "#999" }} />
                        {subjectById.get(subjectId)?.name ?? "Unknown subject"}
                      </span>
                      <span className="text-ink-muted">{formatMinutes(minutes)}</span>
                    </li>
                  ))}
              </ul>
              <p className="mt-3 text-xs text-ink-muted">{formatMinutes(totalMinutes)} total this week</p>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-accent" /> Journal highlights
          </h2>
          {journaledDays.length === 0 ? (
            <p className="text-sm text-ink-muted">No journal entries this week.</p>
          ) : (
            <ul className="-mx-5 divide-y divide-line">
              {journaledDays.map(({ dateISO, entry }) => (
                <li key={dateISO}>
                  <Link href={`/journal?date=${dateISO}`} className="block px-5 py-2.5 hover:bg-paper">
                    <p className="text-xs font-medium text-ink-muted">{formatLong(dateISO)}</p>
                    {entry!.bodyText.trim() && <p className="mt-1 text-sm text-ink">{snippet(entry!.bodyText)}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
