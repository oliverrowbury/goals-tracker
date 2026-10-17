import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/user";
import { formatMinutes } from "@/lib/study";
import { formatDistance } from "@/lib/workout";
import { getYearlyRecapData } from "@/app/(main)/YearlyRecap";
import { RecapDocument } from "@/lib/pdf/RecapDocument";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isPremium) return NextResponse.redirect(new URL("/settings#premium", request.url));

  const yearParam = request.nextUrl.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getUTCFullYear();
  const data = await getYearlyRecapData(user.id, year);

  const pdf = await renderToBuffer(
    <RecapDocument
      title={String(data.year)}
      subtitle="Year in review"
      stats={[
        { label: "journal entries", value: String(data.journalEntryCount) },
        { label: "goals completed", value: String(data.goalsCompletedCount) },
        { label: "workouts", value: String(data.workoutSessionCount) },
      ]}
      subjects={data.subjectMinutes}
      subjectsTotalLabel={`${formatMinutes(data.totalMinutes)} total this year`}
      subjectsEmptyLabel="No study time logged this year."
      workoutSummaryLabel={
        data.workoutSessionCount === 0
          ? "No workouts logged this year."
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
      "Content-Disposition": `attachment; filename="proudly-yearly-recap-${data.year}.pdf"`,
    },
  });
}
