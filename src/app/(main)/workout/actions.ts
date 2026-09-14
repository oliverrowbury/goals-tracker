"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { minutesBetween } from "@/lib/study";
import { toKg, toKm } from "@/lib/workout";
import type { WorkoutType } from "@/lib/constants";
import { awardXp, XP_AWARDS } from "@/lib/xp";

function revalidateWorkoutViews() {
  revalidatePath("/workout");
  revalidatePath("/journal");
  revalidatePath("/goals");
  revalidatePath("/");
}

// Same "only one timer at a time" rule as Study — closing out anything left
// open (e.g. a tab closed mid-workout) before starting a new one.
async function closeStrayOpenWorkouts(userId: string) {
  const open = await prisma.workout.findMany({ where: { userId, endedAt: null } });
  for (const workout of open) {
    const endedAt = new Date();
    await prisma.workout.update({
      where: { id: workout.id },
      data: { endedAt, durationMinutes: minutesBetween(workout.startedAt ?? endedAt, endedAt) },
    });
  }
}

export async function startWorkout(type: WorkoutType, label: string) {
  const user = await getCurrentUser();
  await closeStrayOpenWorkouts(user.id);

  await prisma.workout.create({
    data: { userId: user.id, type, label: label.trim() || "Workout", date: new Date(), startedAt: new Date() },
  });

  revalidateWorkoutViews();
}

export async function addSet(workoutId: string, exerciseId: string, formData: FormData) {
  const enteredWeight = Number(formData.get("weight"));
  const reps = Number(formData.get("reps"));
  const isWarmup = formData.get("isWarmup") === "on";
  if (!Number.isFinite(enteredWeight) || enteredWeight < 0 || !Number.isFinite(reps) || reps <= 0) return;

  // The form takes the weight in whatever unit the user has set in
  // Settings — convert to canonical kg before storing, so weightUnit on
  // the row can just stay at its KG default and every set is comparable.
  const user = await getCurrentUser();
  const weight = toKg(enteredWeight, user.weightUnit);

  const count = await prisma.workoutSet.count({ where: { workoutId, exerciseId } });
  await prisma.workoutSet.create({
    data: { workoutId, exerciseId, setNumber: count + 1, weight, reps, isWarmup },
  });
  revalidateWorkoutViews();
}

export async function removeSet(setId: string) {
  await prisma.workoutSet.delete({ where: { id: setId } });
  revalidateWorkoutViews();
}

export async function renameWorkout(workoutId: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) return;
  await prisma.workout.update({ where: { id: workoutId }, data: { label: trimmed } });
  revalidateWorkoutViews();
}

export async function finishStrengthWorkout(workoutId: string) {
  const workout = await prisma.workout.findUniqueOrThrow({ where: { id: workoutId } });
  const setCount = await prisma.workoutSet.count({ where: { workoutId } });

  // Finishing with nothing logged (started it, then tapped Finish without
  // adding any exercise/set) has no value to keep — treat it the same as
  // discarding, rather than leaving a "0 exercises · 0 sets · 0m" row
  // cluttering the log and inflating "sessions this week".
  if (setCount === 0) {
    await prisma.workout.delete({ where: { id: workoutId } });
    revalidateWorkoutViews();
    return;
  }

  const endedAt = new Date();
  await prisma.workout.update({
    where: { id: workoutId },
    data: { endedAt, durationMinutes: minutesBetween(workout.startedAt ?? endedAt, endedAt) },
  });
  await awardXp(workout.userId, XP_AWARDS.WORKOUT);

  revalidateWorkoutViews();
}

// Trusts the client-tracked GPS points as-is (already filtered for
// accuracy/plausible speed by useGpsTrack) — just checks the shape so a
// malformed or missing value can't crash the update. Anything short of two
// points isn't a route worth drawing, so it's dropped rather than stored.
function parseRoute(raw: string): { lat: number; lng: number }[] | undefined {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const points = parsed.filter(
      (p): p is { lat: number; lng: number } =>
        p && typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng),
    );
    return points.length >= 2 ? points : undefined;
  } catch {
    return undefined;
  }
}

export async function finishCardioWorkout(workoutId: string, formData: FormData) {
  const enteredDistance = Number(formData.get("distance"));
  const route = parseRoute(String(formData.get("route") ?? ""));
  const user = await getCurrentUser();
  const workout = await prisma.workout.findUniqueOrThrow({ where: { id: workoutId } });
  const endedAt = new Date();

  // Same unit-at-the-edges rule as addSet — the input is in the user's
  // chosen distance unit, converted to canonical km for storage.
  const distanceKm = Number.isFinite(enteredDistance) && enteredDistance > 0 ? toKm(enteredDistance, user.distanceUnit) : null;
  const durationMinutes = minutesBetween(workout.startedAt ?? endedAt, endedAt);

  await prisma.workout.update({
    where: { id: workoutId },
    data: { endedAt, durationMinutes, distanceKm, route },
  });

  // Same sub-minute guard as a study session — not worth awarding, and
  // guards against an instant start/finish to farm XP.
  if (durationMinutes >= 1) await awardXp(user.id, XP_AWARDS.WORKOUT);

  revalidateWorkoutViews();
}

// Used both for "started by accident, discard it" on an open session and
// for deleting a finished workout from history — same operation either way.
export async function deleteWorkout(workoutId: string) {
  await prisma.$transaction([
    prisma.workoutSet.deleteMany({ where: { workoutId } }),
    prisma.workout.delete({ where: { id: workoutId } }),
  ]);
  revalidateWorkoutViews();
}

export type CreateExerciseState =
  | { error: string; exercise?: undefined }
  | { error?: undefined; exercise: { id: string; name: string; category: string } }
  | null;

export async function createExercise(_prev: CreateExerciseState, formData: FormData): Promise<CreateExerciseState> {
  const user = await getCurrentUser();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "Other";
  if (!name) return { error: "Exercise name is required" };

  const existing = await prisma.exercise.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, OR: [{ userId: null }, { userId: user.id }] },
  });
  if (existing) return { error: `"${existing.name}" already exists — pick it from the list instead` };

  const created = await prisma.exercise.create({ data: { userId: user.id, name, category, isCustom: true } });
  revalidatePath("/workout");
  return { exercise: { id: created.id, name: created.name, category: created.category } };
}
