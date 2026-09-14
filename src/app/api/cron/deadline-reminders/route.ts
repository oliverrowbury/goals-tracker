import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import type { DeadlineReminderKind } from "@/generated/prisma/enums";

// One reminder each at a week, a day, and an hour before. This route is
// meant to be hit roughly once an hour (see vercel.json — 24 separate cron
// entries, one per hour, since Vercel's Hobby plan only allows each
// individual job to fire once a day but allows many jobs), so the window
// below is wide enough that an hourly check can't miss the target moment
// even with Vercel's own "anywhere within the scheduled hour" slop.
const WINDOW_MS = 65 * 60_000;

const OFFSETS: Record<DeadlineReminderKind, number> = {
  WEEK_BEFORE: 7 * 24 * 60 * 60_000,
  DAY_BEFORE: 24 * 60 * 60_000,
  HOUR_BEFORE: 60 * 60_000,
};

const LABELS: Record<DeadlineReminderKind, string> = {
  WEEK_BEFORE: "in a week",
  DAY_BEFORE: "tomorrow",
  HOUR_BEFORE: "in an hour",
};

// dueDate is UTC-midnight for the calendar day; dueTime "HH:mm" is
// interpreted directly as that same UTC day rather than converted through
// UK local time/DST — the same simplification the goal-reminder cron
// already makes for "which day", just extended to "which moment".
function dueAtMs(dueDate: Date, dueTime: string): number {
  const [h, m] = dueTime.split(":").map(Number);
  const due = new Date(dueDate);
  due.setUTCHours(h, m, 0, 0);
  return due.getTime();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();

  const deadlines = await prisma.deadline.findMany({
    where: { completed: false },
    include: { remindersSent: true },
  });

  let sent = 0;
  await Promise.all(
    deadlines.map(async (deadline) => {
      const dueAt = dueAtMs(deadline.dueDate, deadline.dueTime);
      const alreadySent = new Set(deadline.remindersSent.map((r) => r.kind));

      for (const kind of Object.keys(OFFSETS) as DeadlineReminderKind[]) {
        if (alreadySent.has(kind)) continue;
        const target = dueAt - OFFSETS[kind];
        if (Math.abs(now - target) > WINDOW_MS / 2) continue;

        await sendPushToUser(deadline.userId, {
          title: "Proudly",
          body: `${deadline.title} is due ${LABELS[kind]}`,
          url: "/deadlines",
        });
        // Recorded even if the user has no push subscription — the
        // reminder "happened" for this deadline/kind either way, and
        // shouldn't be retried forever just because they never enabled
        // notifications on any device.
        await prisma.deadlineReminderSent.create({ data: { deadlineId: deadline.id, kind } }).catch(() => {});
        sent++;
      }
    }),
  );

  return NextResponse.json({ sent, checkedDeadlines: deadlines.length });
}
