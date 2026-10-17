"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { isoToDate, dateToISO, todayISO, isFutureISO } from "@/lib/dates";
import { uploadJournalPhoto, deleteJournalPhoto } from "@/lib/storage";
import { awardXp, XP_AWARDS } from "@/lib/xp";
import { awardBadge, awardStreakBadges } from "@/lib/badges";
import { computeStreak } from "@/lib/streaks";
import { FREE_LIMITS } from "@/lib/limits";

export async function saveJournalEntry(dateISO: string, bodyText: string, improveText: string, notes: string) {
  if (isFutureISO(dateISO)) return;
  const user = await getCurrentUser();
  const date = isoToDate(dateISO);

  const existing = await prisma.journalEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
  await prisma.journalEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { bodyText, improveText, notes },
    create: { userId: user.id, date, bodyText, improveText, notes },
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

  // Only a day getting its FIRST photo counts against the cap — replacing
  // a day's existing photo isn't a new slot.
  if (!user.isPremium && !existing?.photoUrl) {
    const photoCount = await prisma.journalEntry.count({ where: { userId: user.id, photoUrl: { not: null } } });
    if (photoCount >= FREE_LIMITS.PHOTOS_PER_CATEGORY) {
      return { error: `You've hit the free limit of ${FREE_LIMITS.PHOTOS_PER_CATEGORY} journal photos on Proudly Normal. Go Premium (Settings) for more.` };
    }
  }

  // Upload the new photo before deleting the old one — uploadJournalPhoto's
  // path is always unique (Date.now()-suffixed), so there's no collision
  // risk, and a failed/flaky upload no longer leaves the entry with no
  // photo at all.
  let photoUrl: string;
  try {
    photoUrl = await uploadJournalPhoto(user.id, dateISO, file);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }

  // Best-effort — a stale or already-gone old photo shouldn't block
  // having just uploaded the new one.
  if (existing?.photoUrl) {
    try {
      await deleteJournalPhoto(existing.photoUrl);
    } catch {
      // ignore
    }
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

const SEARCH_RESULT_LIMIT = 10;
const SNIPPET_RADIUS = 60;

export type JournalSearchResult = { dateISO: string; snippet: string };

// A plain case-insensitive substring match across the three free-text
// fields, not full-text search — there's no index for that, and at the
// scale this app runs at (one person's own journal) it doesn't need one.
function buildSnippet(text: string, query: string): string {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return text.slice(0, SNIPPET_RADIUS * 2).trim();
  const start = Math.max(0, i - SNIPPET_RADIUS);
  const end = Math.min(text.length, i + query.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export async function searchJournalEntries(query: string): Promise<JournalSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const user = await getCurrentUser();

  const entries = await prisma.journalEntry.findMany({
    where: {
      userId: user.id,
      OR: [
        { bodyText: { contains: trimmed, mode: "insensitive" } },
        { improveText: { contains: trimmed, mode: "insensitive" } },
        { promptResponse: { contains: trimmed, mode: "insensitive" } },
        { notes: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    orderBy: { date: "desc" },
    take: SEARCH_RESULT_LIMIT,
    select: { date: true, bodyText: true, improveText: true, promptResponse: true, notes: true },
  });

  return entries.map((e) => {
    const text = [e.bodyText, e.improveText, e.promptResponse, e.notes].find((t) => t?.toLowerCase().includes(trimmed.toLowerCase())) ?? e.bodyText;
    return { dateISO: dateToISO(e.date), snippet: buildSnippet(text, trimmed) };
  });
}
