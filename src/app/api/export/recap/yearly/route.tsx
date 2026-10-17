import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user";
import { buildYearlyRecapPdf } from "@/lib/pdf/buildRecapPdf";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isPremium) return NextResponse.redirect(new URL("/settings#premium", request.url));

  const yearParam = request.nextUrl.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getUTCFullYear();
  const { pdf, filename } = await buildYearlyRecapPdf(user.id, year, user.distanceUnit);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
