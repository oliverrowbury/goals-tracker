"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { isoToDate, todayISO, isFutureISO } from "@/lib/dates";
import { uploadJournalPhoto, deleteJournalPhoto } from "@/lib/storage";
import { awardXp, XP_AWARDS } from "@/lib/xp";
import { awardBadge, awardStreakBadges } from "@/lib/badges";
import { computeStreak } from "@/lib/streaks";

export async function saveJournalEntry(dateISO: string, bodyText: string, improveText: string) {
  if (isFutureISO(dateISO)) return;
  const user = await getCurrentUser();
  const date = isoToDate(dateISO);

  const existing = await prisma.journalEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
  await prisma.journalEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { bodyText, improveText },
    create: { userId: user.id, date, bodyText, improveText },
  });

  // Only the first time this day's entry goes from empty to written —
  // otherwise every autosave keystroke would re-award it.
  if (bodyText.trim() && !existing?.bodyText.trim()) {
    await awardXp(user.id, XP_AWARDS.JOURNAL_ENTRY);

    const journaledDates = await prisma.journalEntry.findMany({
      where: { userId: user.id, bodyText: { not: "" } },
      select: { date: true },
    });
    if (journaledDates.length === 1) await awardBadge(user.id, "FIRST_JOURNAL_ENTRY");
    const streak = computeStreak(new Set(journaledDates.map((e) => e.date.toISOString().slice(0, 10))), todayISO());
    await awardStreakBadges(user.id, "JOURNAL", streak);
  }

  revalidatePath("/journal");
}

export async function setMood(dateISO: string, mood: number) {
  if (isFutureISO(dateISO)) return;
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
  if (isFutureISO(dateISO)) return;
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
  if (isFutureISO(dateISO)) return { error: "Can't add a photo to a day that hasn't happened yet" };
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
  if (isFutureISO(dateISO)) return;
  const user = await getCurrentUser();
  const date = isoToDate(dateISO);
  const entry = await prisma.journalEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (!entry?.photoUrl) return;

  await deleteJournalPhoto(entry.photoUrl);
  await prisma.journalEntry.update({ where: { id: entry.id }, data: { photoUrl: null } });
  revalidatePath("/journal");
}
