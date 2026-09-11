import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

// Everything under this user's id, as one JSON file — the "ask for a copy
// of your data" promise from the Privacy Policy, made self-service. Proxy
// middleware already requires a valid session for every route except the
// few explicitly excluded ones, so this is already auth-gated.
export async function GET() {
  const user = await getCurrentUser();

  const [journalEntries, goals, goalLogs, subjects, studySessions, feedback] = await Promise.all([
    prisma.journalEntry.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    prisma.goal.findMany({ where: { userId: user.id } }),
    prisma.goalLog.findMany({ where: { goal: { userId: user.id } } }),
    prisma.subject.findMany({ where: { userId: user.id } }),
    prisma.studySession.findMany({ where: { userId: user.id } }),
    prisma.feedback.findMany({ where: { userId: user.id } }),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    user: { email: user.email, name: user.name, createdAt: user.createdAt },
    journalEntries,
    goals,
    goalLogs,
    subjects,
    studySessions,
    feedback,
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="proudly-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
