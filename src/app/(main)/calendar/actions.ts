"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { isoToDate } from "@/lib/dates";

export type CalendarEventState = { error: string } | null;

// Shaped as a useActionState reducer, same reasoning as study/actions.ts's
// createSubject — a thrown error from a form's action prop doesn't get
// caught cleanly on the client.
export async function createCalendarEvent(_prev: CalendarEventState, formData: FormData): Promise<CalendarEventState> {
  const user = await getCurrentUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required" };
  const dateISO = String(formData.get("date") ?? "");
  if (!dateISO) return { error: "Date is required" };
  const time = String(formData.get("time") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  await prisma.calendarEvent.create({
    data: { userId: user.id, title, date: isoToDate(dateISO), time: time || null, notes: notes || null },
  });

  revalidatePath(`/calendar/${dateISO}`);
  revalidatePath("/calendar");
  return null;
}

// eventId is the leading arg so this can be bound (updateCalendarEvent.bind(null, eventId))
// into exactly the (prevState, formData) shape useActionState expects —
// same pattern as updateDeadline's edit page, adapted for a client-side bind.
export async function updateCalendarEvent(
  eventId: string,
  _prev: CalendarEventState,
  formData: FormData,
): Promise<CalendarEventState> {
  const user = await getCurrentUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required" };
  const dateISO = String(formData.get("date") ?? "");
  if (!dateISO) return { error: "Date is required" };
  const time = String(formData.get("time") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  // updateMany (not update) so this only ever touches a row that's
  // actually this user's — same reasoning as goals/actions.ts's updateGoal.
  await prisma.calendarEvent.updateMany({
    where: { id: eventId, userId: user.id },
    data: { title, date: isoToDate(dateISO), time: time || null, notes: notes || null },
  });

  revalidatePath(`/calendar/${dateISO}`);
  revalidatePath("/calendar");
  return null;
}

export async function deleteCalendarEvent(eventId: string, dateISO: string) {
  const user = await getCurrentUser();
  await prisma.calendarEvent.deleteMany({ where: { id: eventId, userId: user.id } });
  revalidatePath(`/calendar/${dateISO}`);
  revalidatePath("/calendar");
}
