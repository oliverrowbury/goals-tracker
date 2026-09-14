"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { isoToDate } from "@/lib/dates";
import { awardXp, XP_AWARDS } from "@/lib/xp";

function readDeadlineFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required");

  const dueDateISO = String(formData.get("dueDate") ?? "");
  if (!dueDateISO) throw new Error("Due date is required");

  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  return {
    title,
    dueDate: isoToDate(dueDateISO),
    subjectId: subjectId || null,
    notes: notes || null,
  };
}

export async function createDeadline(formData: FormData) {
  const user = await getCurrentUser();
  const fields = readDeadlineFields(formData);

  await prisma.deadline.create({ data: { ...fields, userId: user.id } });

  revalidatePath("/deadlines");
  revalidatePath("/");
  redirect("/deadlines");
}

export async function updateDeadline(deadlineId: string, formData: FormData) {
  const fields = readDeadlineFields(formData);

  await prisma.deadline.update({ where: { id: deadlineId }, data: fields });

  revalidatePath("/deadlines");
  revalidatePath("/");
  redirect("/deadlines");
}

export async function toggleDeadlineCompleted(deadlineId: string) {
  const deadline = await prisma.deadline.findUniqueOrThrow({ where: { id: deadlineId } });
  const completed = !deadline.completed;

  await prisma.deadline.update({ where: { id: deadlineId }, data: { completed } });

  // Same not-done <-> done transition pattern as goals — award once,
  // undone cleanly if un-ticked.
  await awardXp(deadline.userId, completed ? XP_AWARDS.DEADLINE_COMPLETE : -XP_AWARDS.DEADLINE_COMPLETE);

  revalidatePath("/deadlines");
  revalidatePath("/");
}

export async function deleteDeadline(deadlineId: string) {
  await prisma.deadline.delete({ where: { id: deadlineId } });

  revalidatePath("/deadlines");
  revalidatePath("/");
}
