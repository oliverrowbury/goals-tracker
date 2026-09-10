"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { minutesBetween } from "@/lib/study";

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

  await prisma.studySession.update({
    where: { id: sessionId },
    data: { endedAt, pausedAt: null, durationMinutes: minutesBetween(session.startedAt, endedAt) },
  });

  revalidateStudyViews();
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
