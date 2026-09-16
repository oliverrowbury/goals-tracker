"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { minutesBetween } from "@/lib/study";
import { isoToDate, todayISO } from "@/lib/dates";
import { awardXp, XP_AWARDS } from "@/lib/xp";
import { awardBadge, awardStreakBadges, awardStudyHoursBadges, awardTimeOfDayBadges } from "@/lib/badges";
import { computeStreak } from "@/lib/streaks";
import type { ActivityVisibility } from "@/generated/prisma/enums";

async function awardStudyBadges(userId: string) {
  const sessions = await prisma.studySession.findMany({
    where: { userId, durationMinutes: { not: null } },
    select: { startedAt: true, durationMinutes: true },
  });
  if (sessions.length === 1) await awardBadge(userId, "FIRST_STUDY_SESSION");
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
  await awardStudyHoursBadges(userId, totalMinutes);
  const streak = computeStreak(new Set(sessions.map((s) => s.startedAt.toISOString().slice(0, 10))), todayISO());
  await awardStreakBadges(userId, "STUDY", streak);
}

function revalidateStudyViews() {
  revalidatePath("/study");
  revalidatePath("/journal");
  revalidatePath("/goals");
  revalidatePath("/");
}

export async function startStudySession(subjectId: string) {
  const user = await getCurrentUser();

  // Only one timer runs at a time — close out anything left open (e.g. a
  // tab that was closed mid-session) before starting the new one. If it was
  // left paused, the paused moment is the real end, not now.
  const openSessions = await prisma.studySession.findMany({
    where: { userId: user.id, endedAt: null },
  });
  for (const session of openSessions) {
    const endedAt = session.pausedAt ?? new Date();
    await prisma.studySession.update({
      where: { id: session.id },
      data: { endedAt, pausedAt: null, durationMinutes: minutesBetween(session.startedAt, endedAt) },
    });
  }

  await prisma.studySession.create({
    data: { userId: user.id, subjectId, startedAt: new Date() },
  });

  revalidateStudyViews();
}

export async function pauseStudySession(sessionId: string) {
  await prisma.studySession.update({
    where: { id: sessionId },
    data: { pausedAt: new Date() },
  });
  revalidateStudyViews();
}

export async function resumeStudySession(sessionId: string) {
  const session = await prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } });
  if (!session.pausedAt) return;

  // Shift startedAt forward by however long it was paused, so elapsed time
  // (now - startedAt) is correct again without a separate accumulator.
  const pausedMs = Date.now() - session.pausedAt.getTime();
  const shiftedStart = new Date(session.startedAt.getTime() + pausedMs);

  await prisma.studySession.update({
    where: { id: sessionId },
    data: { startedAt: shiftedStart, pausedAt: null },
  });
  revalidateStudyViews();
}

export async function finishStudySession(sessionId: string) {
  const session = await prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } });
  const endedAt = session.pausedAt ?? new Date();
  const durationMinutes = minutesBetween(session.startedAt, endedAt);

  await prisma.studySession.update({
    where: { id: sessionId },
    data: { endedAt, pausedAt: null, durationMinutes },
  });

  // A sub-minute session isn't worth awarding — mainly guards against
  // immediately starting and finishing a timer to farm XP.
  if (durationMinutes >= 1) {
    await awardXp(session.userId, XP_AWARDS.STUDY_SESSION);
    await awardStudyBadges(session.userId);
    await awardTimeOfDayBadges(session.userId, endedAt);
  }

  revalidateStudyViews();
}

// Chosen on the post-finish summary screen — same idea as
// setWorkoutVisibility, see its comment for how this combines with the
// account-level shareStudyStreak switch.
export async function setStudySessionVisibility(sessionId: string, visibility: ActivityVisibility) {
  const user = await getCurrentUser();
  await prisma.studySession.updateMany({ where: { id: sessionId, userId: user.id }, data: { visibility } });
  revalidatePath("/friends");
}

// The post-finish summary screen's caption field — StudySession.note
// already exists in the schema but had no UI anywhere until now.
export async function setStudySessionNote(sessionId: string, note: string) {
  const user = await getCurrentUser();
  await prisma.studySession.updateMany({ where: { id: sessionId, userId: user.id }, data: { note: note.trim() || null } });
  revalidatePath("/friends");
}

export async function deleteStudySession(sessionId: string) {
  const session = await prisma.studySession.findUnique({ where: { id: sessionId } });
  if (!session) return; // already gone — nothing to do

  await prisma.studySession.delete({ where: { id: sessionId } });

  // Only one open session should ever exist per user. If the one just
  // discarded was still open, sweep up any other stray open session too —
  // otherwise a leftover duplicate (e.g. from a double-click race, or an
  // old bug before startStudySession closed out open sessions) would make
  // the timer immediately show "Studying X" again right after discarding,
  // looking exactly like the delete silently failed.
  if (session.endedAt === null) {
    await prisma.studySession.deleteMany({ where: { userId: session.userId, endedAt: null } });
  }

  revalidateStudyViews();
}

export type LogManualSessionState = { error: string } | null;

// For "forgot to start the timer" — creates a normal, already-finished
// session rather than a separate kind of record, so it shows up in stats,
// streaks, goal auto-tracking, and Recap exactly like a timed one would.
export async function logManualSession(
  _prev: LogManualSessionState,
  formData: FormData,
): Promise<LogManualSessionState> {
  const user = await getCurrentUser();
  const subjectId = String(formData.get("subjectId") ?? "");
  const minutes = Number(formData.get("minutes"));
  const dateISO = String(formData.get("date") ?? "");

  if (!subjectId) return { error: "Choose a subject" };
  if (!Number.isFinite(minutes) || minutes <= 0) return { error: "Enter how many minutes" };
  if (!dateISO) return { error: "Choose a date" };

  const startedAt = isoToDate(dateISO);
  startedAt.setUTCHours(12); // midday, so it never lands on a day boundary
  const endedAt = new Date(startedAt.getTime() + minutes * 60_000);

  await prisma.studySession.create({
    data: { userId: user.id, subjectId, startedAt, endedAt, durationMinutes: minutes },
  });
  await awardXp(user.id, XP_AWARDS.STUDY_SESSION);
  await awardStudyBadges(user.id);

  revalidateStudyViews();
  return null;
}

export type CreateSubjectState = { error: string } | null;

// Shaped as a useActionState reducer (prevState, formData) rather than a
// plain function that throws — a thrown error from a form's action prop
// doesn't get caught cleanly on the client (confirmed: it broke React's
// form submit handling entirely), whereas returned state is the pattern
// already working for changePassword.
export async function createSubject(_prev: CreateSubjectState, formData: FormData): Promise<CreateSubjectState> {
  const user = await getCurrentUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Subject name is required" };

  const existing = await prisma.subject.findFirst({
    where: { userId: user.id, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return {
      error: existing.active
        ? `You already have a subject called "${existing.name}"`
        : `"${existing.name}" already exists but is archived — reactivate it from Settings instead of adding it again`,
    };
  }

  const colors = ["#c1592f", "#4f7ba6", "#5f9e6f", "#a25fa6", "#c99a3e"];
  const count = await prisma.subject.count({ where: { userId: user.id } });

  await prisma.subject.create({
    data: { userId: user.id, name, color: colors[count % colors.length] },
  });

  revalidatePath("/study");
  revalidatePath("/settings");
  return null;
}
