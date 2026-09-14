import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { todayISO, shiftISO } from "@/lib/dates";
import { formatMinutes } from "@/lib/study";

// Fires once a week (see vercel.json — Sunday evening), one push per user
// summarizing the last 7 days, linking back to the in-app recap on the
// home page (WeeklyRecap.tsx) rather than duplicating its detail here.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayISO();
  const startISO = shiftISO(today, -6);
  const rangeStart = new Date(`${startISO}T00:00:00.000Z`);
  const rangeEnd = new Date(`${today}T23:59:59.999Z`);

  const users = await prisma.user.findMany({ where: { pushSubscriptions: { some: {} } }, select: { id: true } });

  let sent = 0;
  await Promise.all(
    users.map(async ({ id: userId }) => {
      const [journalDays, studySessions, workouts, goalLogs] = await Promise.all([
        prisma.journalEntry.count({
          where: { userId, date: { gte: rangeStart, lte: rangeEnd }, bodyText: { not: "" } },
        }),
        prisma.studySession.findMany({
          where: { userId, endedAt: { not: null }, startedAt: { gte: rangeStart, lte: rangeEnd } },
          select: { durationMinutes: true },
        }),
        prisma.workout.count({ where: { userId, endedAt: { not: null }, date: { gte: rangeStart, lte: rangeEnd } } }),
        prisma.goalLog.count({
          where: { goal: { userId }, completed: true, date: { gte: rangeStart, lte: rangeEnd } },
        }),
      ]);

      const studyMinutes = studySessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

      // Nothing at all logged this week — skip rather than send an empty,
      // slightly guilt-trippy "you did nothing" push.
      if (journalDays === 0 && studyMinutes === 0 && workouts === 0 && goalLogs === 0) return;

      const parts: string[] = [];
      if (journalDays > 0) parts.push(`${journalDays} journal ${journalDays === 1 ? "entry" : "entries"}`);
      if (studyMinutes > 0) parts.push(`${formatMinutes(studyMinutes)} studied`);
      if (workouts > 0) parts.push(`${workouts} workout${workouts === 1 ? "" : "s"}`);
      if (goalLogs > 0) parts.push(`${goalLogs} goal${goalLogs === 1 ? "" : "s"} ticked off`);

      await sendPushToUser(userId, {
        title: "Your week, recapped",
        body: parts.join(" · "),
        url: "/",
      });
      sent++;
    }),
  );

  return NextResponse.json({ sent, checkedUsers: users.length });
}
