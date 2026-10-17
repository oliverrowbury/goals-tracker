import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { Goal, GoalLog, Reminder, Workout, WorkoutSet } from "@/generated/prisma/client";

// Premium's 30-day recovery window — see schema.prisma's TrashedItem for
// why this snapshots full rows as JSON rather than a deletedAt column on
// Goal/Workout themselves.
export const TRASH_RETENTION_DAYS = 30;

type GoalSnapshot = { goal: Goal; logs: GoalLog[]; reminders: Reminder[] };
type WorkoutSnapshot = { workout: Workout; sets: WorkoutSet[] };

// Dates round-trip through the JSON column as ISO strings, not Date
// instances — toJson()/fromJson() are the only two places that matters,
// converting at the edges so the rest of the app only ever sees the real
// Goal/Workout/etc. types.
function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function reviveDates<T extends Record<string, unknown>>(row: T, dateKeys: (keyof T)[]): T {
  const revived = { ...row };
  for (const key of dateKeys) {
    if (revived[key] != null) revived[key] = new Date(revived[key] as string) as T[typeof key];
  }
  return revived;
}

function reviveGoalSnapshot(payload: unknown): GoalSnapshot {
  const { goal, logs, reminders } = payload as GoalSnapshot;
  return {
    goal: reviveDates(goal, ["startDate", "endDate", "createdAt"]),
    logs: logs.map((log) => reviveDates(log, ["date"])),
    reminders,
  };
}

function reviveWorkoutSnapshot(payload: unknown): WorkoutSnapshot {
  const { workout, sets } = payload as WorkoutSnapshot;
  return {
    workout: reviveDates(workout, ["date", "startedAt", "endedAt", "aiAdviceGeneratedAt"]),
    sets,
  };
}

// Snapshots a goal (with its logs/reminders, which reference it without
// cascade delete) into the trash, then hard-deletes the originals — one
// transaction, so a crash mid-way can never lose data or leave an orphan.
export async function trashGoal(goal: Goal): Promise<void> {
  const [logs, reminders] = await Promise.all([
    prisma.goalLog.findMany({ where: { goalId: goal.id } }),
    prisma.reminder.findMany({ where: { goalId: goal.id } }),
  ]);
  const snapshot: GoalSnapshot = { goal, logs, reminders };

  await prisma.$transaction([
    prisma.trashedItem.create({
      data: { userId: goal.userId, kind: "GOAL", label: goal.title, payload: toJson(snapshot) },
    }),
    prisma.goalLog.deleteMany({ where: { goalId: goal.id } }),
    prisma.reminder.deleteMany({ where: { goalId: goal.id } }),
    prisma.goal.delete({ where: { id: goal.id } }),
  ]);
}

export async function trashWorkout(workout: Workout): Promise<void> {
  const sets = await prisma.workoutSet.findMany({ where: { workoutId: workout.id } });
  const snapshot: WorkoutSnapshot = { workout, sets };

  await prisma.$transaction([
    prisma.trashedItem.create({
      data: {
        userId: workout.userId,
        kind: "WORKOUT",
        label: `${workout.label} (${workout.date.toISOString().slice(0, 10)})`,
        payload: toJson(snapshot),
      },
    }),
    prisma.workoutSet.deleteMany({ where: { workoutId: workout.id } }),
    prisma.workout.delete({ where: { id: workout.id } }),
  ]);
}

export type TrashedItemSummary = {
  id: string;
  kind: "GOAL" | "WORKOUT";
  label: string;
  deletedAt: Date;
  expiresAt: Date;
};

// Only within the retention window — an item past it is treated as gone
// even if purgeExpiredTrash hasn't swept it yet (see that function).
export async function listTrashedItems(userId: string): Promise<TrashedItemSummary[]> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const items = await prisma.trashedItem.findMany({
    where: { userId, deletedAt: { gte: cutoff } },
    orderBy: { deletedAt: "desc" },
  });
  return items.map((item) => ({
    id: item.id,
    kind: item.kind,
    label: item.label,
    deletedAt: item.deletedAt,
    expiresAt: new Date(item.deletedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  }));
}

// Re-creates the original row(s) with their original ids — restoring a
// workout by its old id also un-orphans any Cheer/Comment rows that still
// point at it (those use plain string FKs with no cascade, so they survive
// the original delete untouched; see schema.prisma's Cheer/Comment).
export async function restoreTrashedItem(userId: string, trashedItemId: string): Promise<void> {
  const item = await prisma.trashedItem.findFirst({ where: { id: trashedItemId, userId } });
  if (!item) return;

  if (item.kind === "GOAL") {
    const { goal, logs, reminders } = reviveGoalSnapshot(item.payload);
    await prisma.$transaction([
      prisma.goal.create({ data: goal }),
      ...(logs.length ? [prisma.goalLog.createMany({ data: logs })] : []),
      ...(reminders.length ? [prisma.reminder.createMany({ data: reminders })] : []),
      prisma.trashedItem.delete({ where: { id: trashedItemId } }),
    ]);
  } else {
    const { workout, sets } = reviveWorkoutSnapshot(item.payload);
    // A plain JS `null` isn't valid for a Json create input — Prisma wants
    // its JsonNull sentinel to mean "set the column to SQL NULL" rather
    // than "field omitted."
    const route = workout.route === null ? Prisma.JsonNull : workout.route;
    await prisma.$transaction([
      prisma.workout.create({ data: { ...workout, route } }),
      ...(sets.length ? [prisma.workoutSet.createMany({ data: sets })] : []),
      prisma.trashedItem.delete({ where: { id: trashedItemId } }),
    ]);
  }
}

// Called from a daily cron (api/cron/purge-trash) — read time deliberately
// doesn't filter this itself beyond the window (see listTrashedItems), so
// an item's "N days left" stays stable instead of being swept mid-render.
export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.trashedItem.deleteMany({ where: { deletedAt: { lt: cutoff } } });
  return count;
}
