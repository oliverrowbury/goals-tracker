import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user";
import { monthISOOf, todayISO } from "@/lib/dates";
import { buildMonthlyRecapPdf } from "@/lib/pdf/buildRecapPdf";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isPremium) return NextResponse.redirect(new URL("/settings#premium", request.url));

  const month = request.nextUrl.searchParams.get("month") ?? monthISOOf(todayISO());
  const { pdf, filename } = await buildMonthlyRecapPdf(user.id, month, user.distanceUnit);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
