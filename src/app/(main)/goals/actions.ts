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

export async function createGoal(formData: FormData) {
  const user = await getCurrentUser();
  const fields = readGoalFields(formData);

  await prisma.goal.create({
    data: { ...fields, userId: user.id, startDate: new Date() },
  });

  revalidatePath("/goals");
  revalidatePath("/journal");
  redirect("/goals");
}

export async function updateGoal(goalId: string, formData: FormData) {
  const fields = readGoalFields(formData);

  await prisma.goal.update({ where: { id: goalId }, data: fields });

  revalidatePath("/goals");
  revalidatePath("/journal");
  redirect("/goals");
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
