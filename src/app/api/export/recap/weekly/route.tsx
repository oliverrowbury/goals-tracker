import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user";
import { todayISO } from "@/lib/dates";
import { buildWeeklyRecapPdf } from "@/lib/pdf/buildRecapPdf";

// Premium-only, same as the on-site recap itself (see WeeklyRecap's own
// lock) — gated here too since a free user could otherwise hit this route
// directly even while their on-site recap is locked.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isPremium) return NextResponse.redirect(new URL("/settings#premium", request.url));

  const week = request.nextUrl.searchParams.get("week") ?? todayISO();
  const { pdf, filename } = await buildWeeklyRecapPdf(user.id, week, user.distanceUnit);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
