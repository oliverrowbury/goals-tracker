import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO } from "@/lib/dates";
import { weekRangeContaining } from "@/lib/goals";
import { WorkoutTracker } from "./WorkoutTracker";
import { ExerciseProgress } from "./ExerciseProgress";
import { estimateOneRepMax } from "@/lib/workout";
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

  // Best (heaviest estimated-1RM) set per exercise per day, in date order —
  // what the Progress panel below charts. Derived from recentFinished
  // (already fetched above for "Last time" hints and the Log) rather than
  // a separate all-time query — this page's data reloads on every single
  // set logged mid-workout, so keeping this to the same bounded lookback
  // avoids adding a second full scan to that hot path. A day can have
  // several sets of the same exercise; only the best one counts, same as
  // Hevy's own progression graphs.
  const progressByExercise = new Map<
    string,
    { exerciseName: string; byDate: Map<string, { weightKg: number; reps: number; estOneRmKg: number }> }
  >();
  for (const workout of recentFinished) {
    const dateISO = workout.date.toISOString().slice(0, 10);
    for (const s of workout.sets) {
      if (s.isWarmup) continue;
      const estOneRmKg = estimateOneRepMax(s.weight, s.reps);
      if (!progressByExercise.has(s.exerciseId)) {
        progressByExercise.set(s.exerciseId, { exerciseName: s.exercise.name, byDate: new Map() });
      }
      const entry = progressByExercise.get(s.exerciseId)!;
      const existing = entry.byDate.get(dateISO);
      if (!existing || estOneRmKg > existing.estOneRmKg) {
        entry.byDate.set(dateISO, { weightKg: s.weight, reps: s.reps, estOneRmKg });
      }
    }
  }
  const exerciseProgress = Array.from(progressByExercise.entries())
    .map(([exerciseId, { exerciseName, byDate }]) => ({
      exerciseId,
      exerciseName,
      points: Array.from(byDate.entries())
        .map(([dateISO, best]) => ({ dateISO, ...best }))
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    }))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));

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
                note: openWorkout.note,
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
          note: w.note,
          dateISO: w.date.toISOString().slice(0, 10),
          durationMinutes: w.durationMinutes,
          distanceKm: w.distanceKm,
          route: (w.route as { lat: number; lng: number }[] | null) ?? null,
          photoUrl: w.photoUrl,
          sets: w.sets.map((s) => ({
            id: s.id,
            exerciseName: s.exercise.name,
            weight: s.weight,
            reps: s.reps,
            isWarmup: s.isWarmup,
          })),
        }))}
      />

      {exerciseProgress.length > 0 && (
        <div className="mt-8">
          <ExerciseProgress exercises={exerciseProgress} weightUnit={user.weightUnit} />
        </div>
      )}
    </div>
  );
}
