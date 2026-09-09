import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

// Reminder times are entered in the Settings UI as UK local time — this
// hardcodes Europe/London rather than storing a per-user timezone, since
// this is still a single-user app. Revisit if/when multiple users in
// different timezones are real.
const REMINDER_TIMEZONE = "Europe/London";

function currentLocalTime(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: REMINDER_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowHHmm = currentLocalTime();

  const dueUsers = await prisma.user.findMany({
    where: { reminderEnabled: true, reminderTime: nowHHmm },
    select: { id: true },
  });

  await Promise.all(
    dueUsers.map((user) =>
      sendPushToUser(user.id, {
        title: "Proudly",
        body: "Got a minute to log today's journal or start a study session?",
        url: "/",
      }),
    ),
  );

  return NextResponse.json({ sent: dueUsers.length, checkedAt: nowHHmm });
}
