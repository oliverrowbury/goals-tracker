"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { minutesBetween } from "@/lib/study";

export async function startStudySession(subjectId: string) {
  const user = await getCurrentUser();

  // Only one timer runs at a time — close out anything left open (e.g. a
  // tab that was closed mid-session) before starting the new one.
  const openSessions = await prisma.studySession.findMany({
    where: { userId: user.id, endedAt: null },
  });
  for (const session of openSessions) {
    const endedAt = new Date();
    await prisma.studySession.update({
      where: { id: session.id },
      data: { endedAt, durationMinutes: minutesBetween(session.startedAt, endedAt) },
    });
  }

  await prisma.studySession.create({
    data: { userId: user.id, subjectId, startedAt: new Date() },
  });

  revalidatePath("/study");
  revalidatePath("/journal");
}

export async function stopStudySession(sessionId: string) {
  const session = await prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } });
  const endedAt = new Date();

  await prisma.studySession.update({
    where: { id: sessionId },
    data: { endedAt, durationMinutes: minutesBetween(session.startedAt, endedAt) },
  });

  revalidatePath("/study");
  revalidatePath("/journal");
  revalidatePath("/goals");
}

export async function createSubject(formData: FormData) {
  const user = await getCurrentUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Subject name is required");

  const colors = ["#c1592f", "#4f7ba6", "#5f9e6f", "#a25fa6", "#c99a3e"];
  const count = await prisma.subject.count({ where: { userId: user.id } });

  await prisma.subject.create({
    data: { userId: user.id, name, color: colors[count % colors.length] },
  });

  revalidatePath("/study");
}
