import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { weekRangeContaining } from "@/lib/goals";
import { todayISO, monthRangeContaining, yearRangeContaining } from "@/lib/dates";
import { StudyTimer } from "./StudyTimer";
import { StudyStats } from "./StudyStats";
import { RecentSessions } from "./RecentSessions";
import { ClockIcon } from "@/components/Icons";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

function totalsBySubject(sessions: { subjectId: string; durationMinutes: number | null }[]) {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    totals.set(session.subjectId, (totals.get(session.subjectId) ?? 0) + (session.durationMinutes ?? 0));
  }
  return Object.fromEntries(totals);
}

// The day/week/month/year queries only pick up finished sessions
// (endedAt not null) — reasonable for the query itself, but it meant the
// "Time by subject" breakdown could say "No study time logged today" while
// the timer above it was visibly running and counting up, which reads as
// the page contradicting itself. This folds the open session's
// elapsed-so-far minutes into whichever period buckets its start date
// actually falls in.
function withOpenSession(
  totals: Record<string, number>,
  openSession: { subjectId: string; startedAt: Date; pausedAt: Date | null } | null,
  rangeStartISO: string,
  rangeEndISO: string,
): Record<string, number> {
  if (!openSession) return totals;
  const startedISO = openSession.startedAt.toISOString().slice(0, 10);
  if (startedISO < rangeStartISO || startedISO > rangeEndISO) return totals;

  const elapsedMs = (openSession.pausedAt ?? new Date()).getTime() - openSession.startedAt.getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  return { ...totals, [openSession.subjectId]: (totals[openSession.subjectId] ?? 0) + elapsedMinutes };
}

export default async function StudyPage() {
  const user = await getCurrentUser();
  const today = todayISO();

  const week = weekRangeContaining(today);
  const month = monthRangeContaining(today);
  const year = yearRangeContaining(today);

  const [subjects, openSession, weekSessions, monthSessions, yearSessions] = await Promise.all([
    prisma.subject.findMany({ where: { userId: user.id, active: true }, orderBy: { name: "asc" } }),
    prisma.studySession.findFirst({ where: { userId: user.id, endedAt: null }, orderBy: { startedAt: "asc" } }),
    prisma.studySession.findMany({
      where: {
        userId: user.id,
        endedAt: { not: null },
        startedAt: { gte: new Date(`${week.startISO}T00:00:00.000Z`), lte: new Date(`${week.endISO}T23:59:59.999Z`) },
      },
      select: { id: true, subjectId: true, durationMinutes: true, startedAt: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.studySession.findMany({
      where: {
        userId: user.id,
        endedAt: { not: null },
        startedAt: { gte: new Date(`${month.startISO}T00:00:00.000Z`), lte: new Date(`${month.endISO}T23:59:59.999Z`) },
      },
      select: { subjectId: true, durationMinutes: true },
    }),
    prisma.studySession.findMany({
      where: {
        userId: user.id,
        endedAt: { not: null },
        startedAt: { gte: new Date(`${year.startISO}T00:00:00.000Z`), lte: new Date(`${year.endISO}T23:59:59.999Z`) },
      },
      select: { subjectId: true, durationMinutes: true },
    }),
  ]);

  return (
    <div>
      <PageHeader icon={ClockIcon} iconClassName="text-study" title="Study" />
      <StudyTimer
        subjects={subjects.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
        serverNow={new Date().toISOString()}
        openSession={
          openSession
            ? {
                id: openSession.id,
                subjectId: openSession.subjectId,
                startedAt: openSession.startedAt.toISOString(),
                pausedAt: openSession.pausedAt?.toISOString() ?? null,
              }
            : null
        }
        weekTotals={totalsBySubject(weekSessions)}
      />

      <div className="mt-8">
        <StudyStats
          subjects={subjects.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
          totalsByPeriod={{
            day: withOpenSession(
              totalsBySubject(weekSessions.filter((s) => s.startedAt.toISOString().slice(0, 10) === today)),
              openSession,
              today,
              today,
            ),
            week: withOpenSession(totalsBySubject(weekSessions), openSession, week.startISO, week.endISO),
            month: withOpenSession(totalsBySubject(monthSessions), openSession, month.startISO, month.endISO),
            year: withOpenSession(totalsBySubject(yearSessions), openSession, year.startISO, year.endISO),
          }}
        />
      </div>

      <div className="mt-8">
        <RecentSessions
          subjects={subjects.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
          sessions={weekSessions.slice(0, 10).map((s) => ({
            id: s.id,
            subjectId: s.subjectId,
            durationMinutes: s.durationMinutes,
            startedAt: s.startedAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
