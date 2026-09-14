import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO } from "@/lib/dates";
import { weekRangeContaining } from "@/lib/goals";
import { WorkoutTracker } from "./WorkoutTracker";
import { DumbbellIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

// How far back to look when building "last time you did this exercise"
// hints — enough history for a personal app without scanning everything.
const LAST_PERFORMED_LOOKBACK = 60;
const HISTORY_LIMIT = 20;

export default async function WorkoutPage() {
  const user = await getCurrentUser();
  const today = todayISO();
  const { startISO, endISO } = weekRangeContaining(today);

  const [exercises, openWorkout, recentFinished, weekWorkouts] = await Promise.all([
    prisma.exercise.findMany({
      where: { OR: [{ userId: null }, { userId: user.id }] },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.workout.findFirst({
      where: { userId: user.id, endedAt: null },
      include: { sets: { include: { exercise: true }, orderBy: { setNumber: "asc" } } },
    }),
    prisma.workout.findMany({
      where: { userId: user.id, endedAt: { not: null } },
      include: { sets: { include: { exercise: true }, orderBy: { setNumber: "asc" } } },
      orderBy: { date: "desc" },
      take: LAST_PERFORMED_LOOKBACK,
    }),
    prisma.workout.findMany({
      where: {
        userId: user.id,
        endedAt: { not: null },
        date: { gte: new Date(`${startISO}T00:00:00.000Z`), lte: new Date(`${endISO}T23:59:59.999Z`) },
      },
      select: { type: true, durationMinutes: true, distanceKm: true },
    }),
  ]);

  // First (most recent) occurrence of each exercise across recent finished
  // workouts — what the "Last time" hint under each exercise shows.
  const lastPerformed: Record<string, { dateISO: string; sets: { weight: number; reps: number; isWarmup: boolean }[] }> = {};
  for (const workout of recentFinished) {
    const dateISO = workout.date.toISOString().slice(0, 10);
    for (const set of workout.sets) {
      if (!lastPerformed[set.exerciseId]) lastPerformed[set.exerciseId] = { dateISO, sets: [] };
      if (lastPerformed[set.exerciseId].dateISO === dateISO) {
        lastPerformed[set.exerciseId].sets.push({ weight: set.weight, reps: set.reps, isWarmup: set.isWarmup });
      }
    }
  }

  const weekSummary = {
    sessions: weekWorkouts.length,
    minutes: weekWorkouts.reduce((sum, w) => sum + (w.durationMinutes ?? 0), 0),
    strengthCount: weekWorkouts.filter((w) => w.type === "STRENGTH").length,
    cardioCount: weekWorkouts.filter((w) => w.type === "CARDIO").length,
    cardioKm: weekWorkouts.reduce((sum, w) => sum + (w.distanceKm ?? 0), 0),
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-2.5">
        <DumbbellIcon className="h-5 w-5 shrink-0 text-workout" />
        <h1 className="font-serif text-2xl font-semibold text-ink">Workout</h1>
      </div>

      <WorkoutTracker
        weightUnit={user.weightUnit}
        distanceUnit={user.distanceUnit}
        exercises={exercises.map((e) => ({ id: e.id, name: e.name, category: e.category }))}
        serverNow={new Date().toISOString()}
        openWorkout={
          openWorkout
            ? {
                id: openWorkout.id,
                type: openWorkout.type,
                label: openWorkout.label,
                startedAt: openWorkout.startedAt!.toISOString(),
                sets: openWorkout.sets.map((s) => ({
                  id: s.id,
                  exerciseId: s.exerciseId,
                  setNumber: s.setNumber,
                  weight: s.weight,
                  reps: s.reps,
                  isWarmup: s.isWarmup,
                })),
              }
            : null
        }
        lastPerformed={lastPerformed}
        weekSummary={weekSummary}
        history={recentFinished.slice(0, HISTORY_LIMIT).map((w) => ({
          id: w.id,
          type: w.type,
          label: w.label,
          dateISO: w.date.toISOString().slice(0, 10),
          durationMinutes: w.durationMinutes,
          distanceKm: w.distanceKm,
          route: (w.route as { lat: number; lng: number }[] | null) ?? null,
          sets: w.sets.map((s) => ({
            id: s.id,
            exerciseName: s.exercise.name,
            weight: s.weight,
            reps: s.reps,
            isWarmup: s.isWarmup,
          })),
        }))}
      />
    </div>
  );
}
