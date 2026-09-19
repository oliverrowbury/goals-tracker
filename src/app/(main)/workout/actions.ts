"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { minutesBetween } from "@/lib/study";
import { toKg, toKm } from "@/lib/workout";
import type { WorkoutType } from "@/lib/constants";
import { awardXp, XP_AWARDS } from "@/lib/xp";
import { awardBadge, awardStreakBadges, awardWorkoutCountBadges, awardTimeOfDayBadges } from "@/lib/badges";
import { computeStreak } from "@/lib/streaks";
import { todayISO, isoToDate } from "@/lib/dates";
import { uploadWorkoutPhoto as uploadWorkoutPhotoToStorage, deleteWorkoutPhoto } from "@/lib/storage";
import type { ActivityVisibility } from "@/generated/prisma/enums";

async function awardWorkoutBadges(userId: string) {
  const workouts = await prisma.workout.findMany({ where: { userId, endedAt: { not: null } }, select: { date: true } });
  if (workouts.length === 1) await awardBadge(userId, "FIRST_WORKOUT");
  await awardWorkoutCountBadges(userId, workouts.length);
  const streak = computeStreak(new Set(workouts.map((w) => w.date.toISOString().slice(0, 10))), todayISO());
  await awardStreakBadges(userId, "WORKOUT", streak);
  await awardTimeOfDayBadges(userId, new Date());
}

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
  // Just /workout, not the full revalidateWorkoutViews() — this fires on
  // every single set logged (many times per workout, exactly the "adding
  // an exercise feels slow at the gym" hot path), and /journal, /goals,
  // and / only ever show week-level workout totals that don't change
  // until the workout actually finishes.
  revalidatePath("/workout");
}

export async function removeSet(setId: string) {
  await prisma.workoutSet.delete({ where: { id: setId } });
  revalidatePath("/workout");
}

export async function renameWorkout(workoutId: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) return;
  await prisma.workout.update({ where: { id: workoutId }, data: { label: trimmed } });
  revalidateWorkoutViews();
}

// Free-text notes about the workout — how it felt, what to try next time,
// etc. Shown on the open workout card while it's running and editable
// again from the log afterwards (see updateWorkoutDetails).
export async function updateWorkoutNote(workoutId: string, note: string) {
  const user = await getCurrentUser();
  await prisma.workout.updateMany({ where: { id: workoutId, userId: user.id }, data: { note: note.trim() || null } });
  revalidateWorkoutViews();
}

// Editing a finished workout from the log — name, note, the date it counts
// toward, and (cardio only) distance/duration, all in one form rather than
// onBlur-per-field like the live tracker, since this is an occasional
// correction rather than something typed continuously.
export async function updateWorkoutDetails(workoutId: string, formData: FormData) {
  const user = await getCurrentUser();
  const workout = await prisma.workout.findFirst({ where: { id: workoutId, userId: user.id } });
  if (!workout) return;

  const label = String(formData.get("label") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const dateISO = String(formData.get("date") ?? "").trim();

  const data: {
    label?: string;
    note?: string | null;
    date?: Date;
    durationMinutes?: number;
    distanceKm?: number | null;
  } = { note: note || null };
  if (label) data.label = label;
  if (dateISO) data.date = isoToDate(dateISO);

  const durationRaw = Number(formData.get("durationMinutes"));
  if (Number.isFinite(durationRaw) && durationRaw > 0) data.durationMinutes = Math.round(durationRaw);

  if (workout.type === "CARDIO") {
    const distanceRaw = String(formData.get("distance") ?? "").trim();
    if (distanceRaw) {
      const distance = Number(distanceRaw);
      if (Number.isFinite(distance) && distance >= 0) data.distanceKm = toKm(distance, user.distanceUnit);
    }
  }

  await prisma.workout.update({ where: { id: workoutId }, data });
  revalidateWorkoutViews();
  revalidatePath("/friends");
}

// Editing one already-logged set (weight/reps) from the log, in whatever
// unit the user currently has set — same conversion-at-the-edges rule as
// addSet.
export async function updateWorkoutSet(setId: string, formData: FormData) {
  const user = await getCurrentUser();
  const enteredWeight = Number(formData.get("weight"));
  const reps = Number(formData.get("reps"));
  if (!Number.isFinite(enteredWeight) || enteredWeight < 0 || !Number.isFinite(reps) || reps <= 0) return;

  const set = await prisma.workoutSet.findFirst({ where: { id: setId }, include: { workout: true } });
  if (!set || set.workout.userId !== user.id) return;

  const weight = toKg(enteredWeight, user.weightUnit);
  await prisma.workoutSet.update({ where: { id: setId }, data: { weight, reps } });
  revalidatePath("/workout");
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
  await awardWorkoutBadges(workout.userId);

  revalidateWorkoutViews();
}

// Trusts the client-tracked GPS points as-is (already filtered for
// accuracy/plausible speed by useGpsTrack) — just checks the shape so a
// malformed or missing value can't crash the update. Anything short of two
// points isn't a route worth drawing, so it's dropped rather than stored.
// t/alt are kept when present (per-point timestamp/altitude) — that's what
// lets splits and elevation gain be computed later, from stored history,
// not just in the moment the workout finishes.
function parseRoute(raw: string): { lat: number; lng: number; t?: number; alt?: number | null }[] | undefined {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const points = parsed
      .filter(
        (p): p is { lat: number; lng: number; t?: number; alt?: number | null } =>
          p && typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng),
      )
      .map((p) => ({
        lat: p.lat,
        lng: p.lng,
        ...(typeof p.t === "number" ? { t: p.t } : {}),
        ...(typeof p.alt === "number" ? { alt: p.alt } : {}),
      }));
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
  if (durationMinutes >= 1) {
    await awardXp(user.id, XP_AWARDS.WORKOUT);
    await awardWorkoutBadges(user.id);
  }

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

// Chosen on the post-finish summary screen — "keep to yourself" vs "share
// with friends" for this one workout specifically, independent of the
// account-level shareWorkoutStreak switch (see ActivityVisibility in
// schema.prisma for how the two combine to gate the friend feed).
export async function setWorkoutVisibility(workoutId: string, visibility: ActivityVisibility) {
  const user = await getCurrentUser();
  await prisma.workout.updateMany({ where: { id: workoutId, userId: user.id }, data: { visibility } });
  revalidatePath("/friends");
}

// The post-finish summary screen's caption field — same note the workout
// already has (also editable mid-workout via WorkoutNoteField, and from the
// log via updateWorkoutDetails), just reachable from the one moment a
// workout's guaranteed to be on screen right after being created.
export async function setWorkoutNote(workoutId: string, note: string) {
  const user = await getCurrentUser();
  await prisma.workout.updateMany({ where: { id: workoutId, userId: user.id }, data: { note: note.trim() || null } });
  revalidatePath("/friends");
}

// The owner's "take this off my profile activity list" toggle — see
// Workout.archived in schema.prisma. Reversible, doesn't touch likes/
// comments/the underlying data, just visibility.
export async function setWorkoutArchived(workoutId: string, archived: boolean) {
  const user = await getCurrentUser();
  await prisma.workout.updateMany({ where: { id: workoutId, userId: user.id }, data: { archived } });
  revalidatePath("/friends");
}

export async function uploadWorkoutPhoto(workoutId: string, formData: FormData): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first" };
  if (!file.type.startsWith("image/")) return { error: "That's not an image file" };

  const workout = await prisma.workout.findFirst({ where: { id: workoutId, userId: user.id } });
  if (!workout) return { error: "Workout not found" };
  if (workout.photoUrl) await deleteWorkoutPhoto(workout.photoUrl);

  let photoUrl: string;
  try {
    photoUrl = await uploadWorkoutPhotoToStorage(user.id, workoutId, file);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }

  await prisma.workout.update({ where: { id: workoutId }, data: { photoUrl } });
  revalidateWorkoutViews();
  revalidatePath("/friends");
  return null;
}

export async function removeWorkoutPhoto(workoutId: string) {
  const user = await getCurrentUser();
  const workout = await prisma.workout.findFirst({ where: { id: workoutId, userId: user.id } });
  if (!workout?.photoUrl) return;

  await deleteWorkoutPhoto(workout.photoUrl);
  await prisma.workout.update({ where: { id: workoutId }, data: { photoUrl: null } });
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
