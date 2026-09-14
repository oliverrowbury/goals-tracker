"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { isoToDate } from "@/lib/dates";
import { awardXp, XP_AWARDS } from "@/lib/xp";
import { awardBadge } from "@/lib/badges";

function readDeadlineFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required");

  const dueDateISO = String(formData.get("dueDate") ?? "");
  if (!dueDateISO) throw new Error("Due date is required");

  const dueTime = String(formData.get("dueTime") ?? "").trim() || "23:59";
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  return {
    title,
    dueDate: isoToDate(dueDateISO),
    dueTime,
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

  // Editing the due date/time invalidates any reminders already sent
  // against the old moment — clearing the log lets them fire again for
  // whatever the new one is, rather than staying silently suppressed.
  await prisma.$transaction([
    prisma.deadline.update({ where: { id: deadlineId }, data: fields }),
    prisma.deadlineReminderSent.deleteMany({ where: { deadlineId } }),
  ]);

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
  if (completed) {
    const count = await prisma.deadline.count({ where: { userId: deadline.userId, completed: true } });
    if (count === 1) await awardBadge(deadline.userId, "FIRST_DEADLINE_COMPLETE");
  }

  revalidatePath("/deadlines");
  revalidatePath("/");
}

export async function deleteDeadline(deadlineId: string) {
  await prisma.deadline.delete({ where: { id: deadlineId } });

  revalidatePath("/deadlines");
  revalidatePath("/");
}
