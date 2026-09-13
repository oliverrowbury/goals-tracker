import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import type { Weekday } from "@/lib/constants";

// Reminders are per-goal now (which days, not what time — see the comment
// on REMINDER_TIME_PLACEHOLDER in goals/actions.ts), checked against UK
// local time since this is still a single-user app. Revisit if/when
// multiple users in different timezones are real.
const REMINDER_TIMEZONE = "Europe/London";

function currentWeekday(): Weekday {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: REMINDER_TIMEZONE, weekday: "short" }).format(new Date());
  const map: Record<string, Weekday> = { Mon: "MON", Tue: "TUE", Wed: "WED", Thu: "THU", Fri: "FRI", Sat: "SAT", Sun: "SUN" };
  return map[short];
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = currentWeekday();

  const dueReminders = await prisma.reminder.findMany({
    where: { enabled: true, daysOfWeek: { has: today } },
    include: { goal: { select: { title: true, userId: true, active: true } } },
  });

  const titlesByUser = new Map<string, string[]>();
  for (const reminder of dueReminders) {
    if (!reminder.goal.active) continue;
    const titles = titlesByUser.get(reminder.goal.userId) ?? [];
    titles.push(reminder.goal.title);
    titlesByUser.set(reminder.goal.userId, titles);
  }

  await Promise.all(
    Array.from(titlesByUser.entries()).map(([userId, titles]) =>
      sendPushToUser(userId, {
        title: "Proudly",
        body: titles.length === 1 ? `Reminder: ${titles[0]}` : `Reminders today: ${titles.join(", ")}`,
        url: "/goals",
      }),
    ),
  );

  return NextResponse.json({ sent: titlesByUser.size, checkedDay: today });
}
