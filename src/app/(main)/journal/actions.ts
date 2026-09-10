"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { isoToDate } from "@/lib/dates";
import { uploadJournalPhoto, deleteJournalPhoto } from "@/lib/storage";

export async function saveJournalEntry(dateISO: string, bodyText: string, improveText: string) {
  const user = await getCurrentUser();
  const date = isoToDate(dateISO);

  await prisma.journalEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { bodyText, improveText },
    create: { userId: user.id, date, bodyText, improveText },
  });

  revalidatePath("/journal");
}

export async function setMood(dateISO: string, mood: number) {
  const user = await getCurrentUser();
  const date = isoToDate(dateISO);

  await prisma.journalEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { mood },
    create: { userId: user.id, date, bodyText: "", mood },
  });

  revalidatePath("/journal");
  revalidatePath("/");
  revalidatePath("/calendar");
}

// Lives on the home page (not the Journal editor's own save flow) — the
// prompt is a lightweight daily check-in, so it saves itself rather than
// waiting on the full journal entry's Save button.
export async function savePromptResponse(dateISO: string, promptResponse: string) {
  const user = await getCurrentUser();
  const date = isoToDate(dateISO);

  await prisma.journalEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { promptResponse },
    create: { userId: user.id, date, bodyText: "", promptResponse },
  });

  revalidatePath("/");
  revalidatePath("/journal");
}

export async function uploadEntryPhoto(dateISO: string, formData: FormData): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first" };
  if (!file.type.startsWith("image/")) return { error: "That's not an image file" };

  const date = isoToDate(dateISO);
  const existing = await prisma.journalEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (existing?.photoUrl) await deleteJournalPhoto(existing.photoUrl);

  let photoUrl: string;
  try {
    photoUrl = await uploadJournalPhoto(user.id, dateISO, file);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }

  await prisma.journalEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { photoUrl },
    create: { userId: user.id, date, bodyText: "", photoUrl },
  });

  revalidatePath("/journal");
  return null;
}

export async function removeEntryPhoto(dateISO: string) {
  const user = await getCurrentUser();
  const date = isoToDate(dateISO);
  const entry = await prisma.journalEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (!entry?.photoUrl) return;

  await deleteJournalPhoto(entry.photoUrl);
  await prisma.journalEntry.update({ where: { id: entry.id }, data: { photoUrl: null } });
  revalidatePath("/journal");
}
