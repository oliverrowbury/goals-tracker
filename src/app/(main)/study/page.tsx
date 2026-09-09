import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { weekRangeContaining } from "@/lib/goals";
import { todayISO, monthRangeContaining, yearRangeContaining } from "@/lib/dates";
import { StudyTimer } from "./StudyTimer";
import { StudyStats } from "./StudyStats";
import { ClockIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

function totalsBySubject(sessions: { subjectId: string; durationMinutes: number | null }[]) {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    totals.set(session.subjectId, (totals.get(session.subjectId) ?? 0) + (session.durationMinutes ?? 0));
  }
  return Object.fromEntries(totals);
}

export default async function StudyPage() {
  const user = await getCurrentUser();
  const today = todayISO();

  const week = weekRangeContaining(today);
  const month = monthRangeContaining(today);
  const year = yearRangeContaining(today);

  const [subjects, openSession, weekSessions, monthSessions, yearSessions] = await Promise.all([
    prisma.subject.findMany({ where: { userId: user.id, active: true }, orderBy: { name: "asc" } }),
    prisma.studySession.findFirst({ where: { userId: user.id, endedAt: null } }),
    prisma.studySession.findMany({
      where: {
        userId: user.id,
        endedAt: { not: null },
        startedAt: { gte: new Date(`${week.startISO}T00:00:00.000Z`), lte: new Date(`${week.endISO}T23:59:59.999Z`) },
      },
      select: { subjectId: true, durationMinutes: true, startedAt: true },
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
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-study-soft text-study">
          <ClockIcon className="h-4.5 w-4.5" />
        </span>
        <h1 className="font-serif text-2xl font-semibold text-ink">Study</h1>
      </div>
      <StudyTimer
        subjects={subjects.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
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
            day: totalsBySubject(weekSessions.filter((s) => s.startedAt.toISOString().slice(0, 10) === today)),
            week: totalsBySubject(weekSessions),
            month: totalsBySubject(monthSessions),
            year: totalsBySubject(yearSessions),
          }}
        />
      </div>
    </div>
  );
}
