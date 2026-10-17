import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/user";
import { monthISOOf, todayISO, formatMonth } from "@/lib/dates";
import { formatMinutes } from "@/lib/study";
import { formatDistance } from "@/lib/workout";
import { getMonthlyRecapData } from "@/app/(main)/MonthlyRecap";
import { RecapDocument } from "@/lib/pdf/RecapDocument";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isPremium) return NextResponse.redirect(new URL("/settings#premium", request.url));

  const month = request.nextUrl.searchParams.get("month") ?? monthISOOf(todayISO());
  const data = await getMonthlyRecapData(user.id, month);

  const pdf = await renderToBuffer(
    <RecapDocument
      title={formatMonth(data.monthISO)}
      subtitle="Monthly recap"
      goals={data.goalSummaries}
      goalsEmptyLabel="No goals due this month."
      subjects={data.subjectMinutes}
      subjectsTotalLabel={`${formatMinutes(data.totalMinutes)} total this month`}
      subjectsEmptyLabel="No study time logged this month."
      workoutSummaryLabel={
        data.workoutSessionCount === 0
          ? "No workouts logged this month."
          : `${data.workoutSessionCount} session${data.workoutSessionCount === 1 ? "" : "s"} · ${formatMinutes(data.workoutMinutes)} total${
              data.cardioKm > 0 ? ` · ${formatDistance(data.cardioKm, user.distanceUnit)} covered` : ""
            }`
      }
      generatedAtLabel={`Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
    />,
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="proudly-monthly-recap-${data.monthISO}.pdf"`,
    },
  });
}
