import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { weekRangeContaining } from "@/lib/goals";
import { todayISO } from "@/lib/dates";
import { StudyTimer } from "./StudyTimer";
import { ClockIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const user = await getCurrentUser();

  const [subjects, openSession, { startISO, endISO }] = await Promise.all([
    prisma.subject.findMany({ where: { userId: user.id, active: true }, orderBy: { name: "asc" } }),
    prisma.studySession.findFirst({ where: { userId: user.id, endedAt: null } }),
    Promise.resolve(weekRangeContaining(todayISO())),
  ]);

  const weekSessions = await prisma.studySession.findMany({
    where: {
      userId: user.id,
      endedAt: { not: null },
      startedAt: { gte: new Date(`${startISO}T00:00:00.000Z`), lte: new Date(`${endISO}T23:59:59.999Z`) },
    },
  });

  const weekTotals = new Map<string, number>();
  for (const session of weekSessions) {
    weekTotals.set(session.subjectId, (weekTotals.get(session.subjectId) ?? 0) + (session.durationMinutes ?? 0));
  }

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
          openSession ? { id: openSession.id, subjectId: openSession.subjectId, startedAt: openSession.startedAt.toISOString() } : null
        }
        weekTotals={Object.fromEntries(weekTotals)}
      />
    </div>
  );
}
