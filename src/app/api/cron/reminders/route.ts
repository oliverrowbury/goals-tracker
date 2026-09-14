import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { REMINDER_SLOTS, type Weekday, type ReminderSlot } from "@/lib/constants";

// Reminders are per-goal (which days + which of the day's fixed slots — see
// the ReminderSlot comment in schema.prisma for why slots rather than an
// arbitrary time), checked against UK local time since this is still a
// single-user app. Revisit if/when multiple users in different timezones
// are real.
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

  const { searchParams } = new URL(request.url);
  const slotParam = searchParams.get("slot");
  const slot = (REMINDER_SLOTS as readonly string[]).includes(slotParam ?? "") ? (slotParam as ReminderSlot) : null;
  if (!slot) {
    return NextResponse.json({ error: "Missing or invalid ?slot= — expected one of " + REMINDER_SLOTS.join(", ") }, { status: 400 });
  }

  const today = currentWeekday();

  const dueReminders = await prisma.reminder.findMany({
    where: { enabled: true, daysOfWeek: { has: today }, slots: { has: slot } },
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

  return NextResponse.json({ sent: titlesByUser.size, checkedDay: today, slot });
}
