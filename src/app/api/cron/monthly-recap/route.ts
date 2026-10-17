import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { sendRecapPdfEmail } from "@/lib/email";
import { buildMonthlyRecapPdf } from "@/lib/pdf/buildRecapPdf";
import { todayISO, shiftISO, monthRangeContaining, monthISOOf } from "@/lib/dates";
import { formatMinutes } from "@/lib/study";

// Fires daily at 18:00 (see vercel.json — days 28-31), but a month only
// has one true last day regardless of its length, so this bails out
// immediately unless today actually is it (checked by seeing whether
// tomorrow rolls over into the 1st) — one push per user summarizing the
// whole month, linking back to the in-app recap on the home page
// (MonthlyRecap.tsx) rather than duplicating its detail here.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayISO();
  const isLastDayOfMonth = shiftISO(today, 1).slice(8, 10) === "01";
  if (!isLastDayOfMonth) {
    return NextResponse.json({ sent: 0, skipped: "not the last day of the month" });
  }

  const { startISO } = monthRangeContaining(today);
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

      // Nothing at all logged this month — skip rather than send an empty,
      // slightly guilt-trippy "you did nothing" push.
      if (journalDays === 0 && studyMinutes === 0 && workouts === 0 && goalLogs === 0) return;

      const parts: string[] = [];
      if (journalDays > 0) parts.push(`${journalDays} journal ${journalDays === 1 ? "entry" : "entries"}`);
      if (studyMinutes > 0) parts.push(`${formatMinutes(studyMinutes)} studied`);
      if (workouts > 0) parts.push(`${workouts} workout${workouts === 1 ? "" : "s"}`);
      if (goalLogs > 0) parts.push(`${goalLogs} goal${goalLogs === 1 ? "" : "s"} ticked off`);

      // sendPushToUser throws synchronously if VAPID isn't configured —
      // caught per-user so one failure (or a VAPID outage) doesn't reject
      // the whole Promise.all and skip every other user's recap this run.
      try {
        await sendPushToUser(userId, {
          title: "Your month, recapped",
          body: parts.join(" · "),
          url: `/?month=${monthISOOf(today)}#monthly-recap`,
        });
        sent++;
      } catch (err) {
        console.error("Failed to send monthly recap push:", err);
      }
    }),
  );

  // Premium perk, additive to the push above — see weekly-recap's own
  // version of this for the full reasoning.
  const premiumUsers = await prisma.user.findMany({
    where: { isPremium: true },
    select: { id: true, email: true, name: true, distanceUnit: true },
  });

  let emailed = 0;
  await Promise.all(
    premiumUsers.map(async ({ id: userId, email, name, distanceUnit }) => {
      const { pdf, filename, isEmpty } = await buildMonthlyRecapPdf(userId, monthISOOf(today), distanceUnit);
      if (isEmpty) return;

      try {
        await sendRecapPdfEmail(email, name, { periodLabel: "monthly", pdf, filename });
        emailed++;
      } catch (err) {
        console.error("Failed to send monthly recap PDF email:", err);
      }
    }),
  );

  return NextResponse.json({ sent, checkedUsers: users.length, emailed, premiumUsers: premiumUsers.length });
}
