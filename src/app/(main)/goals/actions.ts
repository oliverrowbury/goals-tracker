"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { isoToDate, isFutureISO } from "@/lib/dates";
import {
  GOAL_FREQUENCY_TYPES,
  WEEKDAYS,
  REMINDER_SLOTS,
  type GoalFrequencyType,
  type Weekday,
  type ReminderSlot,
} from "@/lib/constants";
import { awardXp, XP_AWARDS } from "@/lib/xp";
import { awardBadge } from "@/lib/badges";

async function awardFirstGoalBadge(userId: string) {
  const count = await prisma.goalLog.count({ where: { completed: true, goal: { userId } } });
  if (count === 1) await awardBadge(userId, "FIRST_GOAL_COMPLETE");
}

function readGoalFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required");

  const frequencyType = String(formData.get("frequencyType"));
  if (!GOAL_FREQUENCY_TYPES.includes(frequencyType as GoalFrequencyType)) {
    throw new Error("Invalid frequency type");
  }

  const targetDays = formData
    .getAll("targetDays")
    .map(String)
    .filter((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(d));

  const targetValueRaw = String(formData.get("targetValue") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  // One select covers both auto-track sources ("subject:<id>" or
  // "workout:SESSIONS"/"workout:MINUTES") — a goal only ever links to one.
  const autoTrack = String(formData.get("autoTrack") ?? "").trim();
  const subjectId = autoTrack.startsWith("subject:") ? autoTrack.slice("subject:".length) : null;
  const workoutMetric =
    autoTrack === "workout:SESSIONS" || autoTrack === "workout:MINUTES"
      ? (autoTrack.slice("workout:".length) as "SESSIONS" | "MINUTES")
      : null;

  if (frequencyType === "WEEKLY_TARGET" && Number(targetValueRaw) <= 0) {
    throw new Error("Target amount needs to be more than 0");
  }

  return {
    title,
    description: description || null,
    frequencyType: frequencyType as GoalFrequencyType,
    targetDays: frequencyType === "SPECIFIC_DAYS" ? targetDays : [],
    targetValue: targetValueRaw ? Number(targetValueRaw) : null,
    unit: frequencyType === "WEEKLY_TARGET" ? unit || null : null,
    subjectId: frequencyType === "WEEKLY_TARGET" ? subjectId : null,
    workoutMetric: frequencyType === "WEEKLY_TARGET" ? workoutMetric : null,
  };
}

function readReminderFields(formData: FormData) {
  const enabled = formData.get("reminderEnabled") === "on";
  const daysOfWeek = formData
    .getAll("reminderDays")
    .map(String)
    .filter((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(d));
  const slots = formData
    .getAll("reminderSlots")
    .map(String)
    .filter((s): s is ReminderSlot => (REMINDER_SLOTS as readonly string[]).includes(s));
  return { enabled: enabled && daysOfWeek.length > 0 && slots.length > 0, daysOfWeek, slots };
}

async function saveGoalReminder(goalId: string, formData: FormData) {
  const { enabled, daysOfWeek, slots } = readReminderFields(formData);
  const existing = await prisma.reminder.findFirst({ where: { goalId } });

  if (existing) {
    await prisma.reminder.update({ where: { id: existing.id }, data: { enabled, daysOfWeek, slots } });
  } else if (enabled) {
    await prisma.reminder.create({
      data: { goalId, enabled, daysOfWeek, slots, channel: "PUSH" },
    });
  }
}

export async function createGoal(formData: FormData) {
  const user = await getCurrentUser();
  const fields = readGoalFields(formData);

  const goal = await prisma.goal.create({
    data: { ...fields, userId: user.id, startDate: new Date() },
  });
  await saveGoalReminder(goal.id, formData);

  revalidatePath("/goals");
  revalidatePath("/journal");
  redirect("/goals");
}

export async function updateGoal(goalId: string, formData: FormData) {
  const fields = readGoalFields(formData);

  await prisma.goal.update({ where: { id: goalId }, data: fields });
  await saveGoalReminder(goalId, formData);

  revalidatePath("/goals");
  revalidatePath("/journal");
  redirect("/goals");
}

export async function deleteGoal(goalId: string) {
  // GoalLog/Reminder rows reference this goal without cascade delete, so
  // they have to go first or the delete hits a foreign-key error.
  await prisma.$transaction([
    prisma.goalLog.deleteMany({ where: { goalId } }),
    prisma.reminder.deleteMany({ where: { goalId } }),
    prisma.goal.delete({ where: { id: goalId } }),
  ]);

  revalidatePath("/goals");
  revalidatePath("/journal");
}

export async function toggleGoalCompletion(goalId: string, dateISO: string) {
  if (isFutureISO(dateISO)) return;
  const date = isoToDate(dateISO);
  const [goal, existing] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goalId }, select: { userId: true } }),
    prisma.goalLog.findUnique({ where: { goalId_date: { goalId, date } } }),
  ]);
  const wasCompleted = existing?.completed ?? false;
  const nowCompleted = !wasCompleted;

  if (existing) {
    await prisma.goalLog.update({ where: { id: existing.id }, data: { completed: nowCompleted } });
  } else {
    await prisma.goalLog.create({ data: { goalId, date, completed: true } });
  }

  // Award on the not-done → done transition, undo it on the reverse — so
  // ticking and un-ticking nets to zero instead of letting the total drift.
  await awardXp(goal.userId, nowCompleted ? XP_AWARDS.GOAL_COMPLETE : -XP_AWARDS.GOAL_COMPLETE);
  if (nowCompleted) await awardFirstGoalBadge(goal.userId);

  revalidatePath("/journal");
  revalidatePath("/goals");
}

export async function setGoalLogValue(goalId: string, dateISO: string, value: number) {
  if (isFutureISO(dateISO)) return;
  const date = isoToDate(dateISO);
  const [goal, existing] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goalId }, select: { userId: true } }),
    prisma.goalLog.findUnique({ where: { goalId_date: { goalId, date } } }),
  ]);
  const wasCompleted = existing?.completed ?? false;
  const nowCompleted = value > 0;

  await prisma.goalLog.upsert({
    where: { goalId_date: { goalId, date } },
    update: { value, completed: nowCompleted },
    create: { goalId, date, value, completed: nowCompleted },
  });

  if (nowCompleted !== wasCompleted) {
    await awardXp(goal.userId, nowCompleted ? XP_AWARDS.GOAL_COMPLETE : -XP_AWARDS.GOAL_COMPLETE);
    if (nowCompleted) await awardFirstGoalBadge(goal.userId);
  }

  revalidatePath("/journal");
  revalidatePath("/goals");
}
