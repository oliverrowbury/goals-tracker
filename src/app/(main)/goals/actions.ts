"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { isoToDate } from "@/lib/dates";
import { GOAL_FREQUENCY_TYPES, WEEKDAYS, type GoalFrequencyType, type Weekday } from "@/lib/constants";

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
  const subjectId = String(formData.get("subjectId") ?? "").trim();

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
    subjectId: frequencyType === "WEEKLY_TARGET" && subjectId ? subjectId : null,
  };
}

// Vercel Hobby cron only runs once a day (see vercel.json), so a per-goal
// time-of-day isn't actually deliverable — only which days a goal reminds
// on is real. timeOfDay is required by the schema but unused for scheduling;
// it's set to match the cron's one daily run purely so the column isn't null.
const REMINDER_TIME_PLACEHOLDER = "18:00";

function readReminderFields(formData: FormData) {
  const enabled = formData.get("reminderEnabled") === "on";
  const daysOfWeek = formData
    .getAll("reminderDays")
    .map(String)
    .filter((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(d));
  return { enabled: enabled && daysOfWeek.length > 0, daysOfWeek };
}

async function saveGoalReminder(goalId: string, formData: FormData) {
  const { enabled, daysOfWeek } = readReminderFields(formData);
  const existing = await prisma.reminder.findFirst({ where: { goalId } });

  if (existing) {
    await prisma.reminder.update({ where: { id: existing.id }, data: { enabled, daysOfWeek } });
  } else if (enabled) {
    await prisma.reminder.create({
      data: { goalId, enabled, daysOfWeek, channel: "PUSH", timeOfDay: REMINDER_TIME_PLACEHOLDER },
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

export async function setGoalActive(goalId: string, active: boolean) {
  await prisma.goal.update({ where: { id: goalId }, data: { active } });
  revalidatePath("/goals");
  revalidatePath("/journal");
}

export async function toggleGoalCompletion(goalId: string, dateISO: string) {
  const date = isoToDate(dateISO);
  const existing = await prisma.goalLog.findUnique({ where: { goalId_date: { goalId, date } } });

  if (existing) {
    await prisma.goalLog.update({ where: { id: existing.id }, data: { completed: !existing.completed } });
  } else {
    await prisma.goalLog.create({ data: { goalId, date, completed: true } });
  }

  revalidatePath("/journal");
  revalidatePath("/goals");
}

export async function setGoalLogValue(goalId: string, dateISO: string, value: number) {
  const date = isoToDate(dateISO);

  await prisma.goalLog.upsert({
    where: { goalId_date: { goalId, date } },
    update: { value, completed: value > 0 },
    create: { goalId, date, value, completed: value > 0 },
  });

  revalidatePath("/journal");
  revalidatePath("/goals");
}
