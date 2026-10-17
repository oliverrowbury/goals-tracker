import { prisma } from "@/lib/prisma";
import { todayISO, isoToDate, yearRangeContaining } from "@/lib/dates";

// A "year in review" summary — rolled up totals rather than a day-by-day
// or goal-by-goal breakdown (both would be noise at this scale). Used only
// for the PDF export (see api/export/recap/yearly), not an on-site page —
// nothing asked for a browsable yearly view, just a printable recap.
export type YearlyRecapData = {
  year: number;
  startISO: string;
  endISO: string;
  journalEntryCount: number;
  goalsCompletedCount: number;
  subjectMinutes: { subjectId: string; name: string; color: string; minutes: number }[];
  totalMinutes: number;
  workoutSessionCount: number;
  workoutMinutes: number;
  cardioKm: number;
};

export async function getYearlyRecapData(userId: string, year: number): Promise<YearlyRecapData> {
  const { startISO, endISO } = yearRangeContaining(`${year}-06-15`);
  const rangeStart = isoToDate(startISO);
  const rangeEnd = new Date(`${endISO}T23:59:59.999Z`);
  const today = todayISO();
  const clampedRangeEnd = rangeEnd > isoToDate(today) ? isoToDate(today) : rangeEnd;

  const [journalEntryCount, goalsCompletedCount, sessions, subjects, workouts] = await Promise.all([
    prisma.journalEntry.count({ where: { userId, bodyText: { not: "" }, date: { gte: rangeStart, lte: clampedRangeEnd } } }),
    prisma.goalLog.count({ where: { completed: true, date: { gte: rangeStart, lte: clampedRangeEnd }, goal: { userId } } }),
    prisma.studySession.findMany({
      where: { userId, endedAt: { not: null }, startedAt: { gte: rangeStart, lte: clampedRangeEnd } },
    }),
    prisma.subject.findMany({ where: { userId } }),
    prisma.workout.findMany({
      where: { userId, endedAt: { not: null }, date: { gte: rangeStart, lte: clampedRangeEnd } },
    }),
  ]);

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const minutesBySubject = new Map<string, number>();
  for (const session of sessions) {
    minutesBySubject.set(session.subjectId, (minutesBySubject.get(session.subjectId) ?? 0) + (session.durationMinutes ?? 0));
  }
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  const subjectMinutes = Array.from(minutesBySubject.entries())
    .map(([subjectId, minutes]) => ({
      subjectId,
      name: subjectById.get(subjectId)?.name ?? "Unknown subject",
      color: subjectById.get(subjectId)?.color ?? "#999",
      minutes,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    year,
    startISO,
    endISO,
    journalEntryCount,
    goalsCompletedCount,
    subjectMinutes,
    totalMinutes,
    workoutSessionCount: workouts.length,
    workoutMinutes: workouts.reduce((sum, w) => sum + (w.durationMinutes ?? 0), 0),
    cardioKm: workouts.reduce((sum, w) => sum + (w.distanceKm ?? 0), 0),
  };
}
