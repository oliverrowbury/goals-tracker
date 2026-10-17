import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/user";
import { todayISO, formatWeekRange } from "@/lib/dates";
import { formatMinutes } from "@/lib/study";
import { formatDistance } from "@/lib/workout";
import { getWeeklyRecapData } from "@/app/(main)/WeeklyRecap";
import { RecapDocument } from "@/lib/pdf/RecapDocument";

// Premium-only, same as the on-site recap itself (see WeeklyRecap's own
// lock) — gated here too since a free user could otherwise hit this route
// directly even while their on-site recap is locked.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user.isPremium) return NextResponse.redirect(new URL("/settings#premium", request.url));

  const week = request.nextUrl.searchParams.get("week") ?? todayISO();
  const data = await getWeeklyRecapData(user.id, week);

  const pdf = await renderToBuffer(
    <RecapDocument
      title={`Week of ${formatWeekRange(data.startISO, data.endISO)}`}
      subtitle="Weekly recap"
      goals={data.goalSummaries}
      goalsEmptyLabel="No goals due this week."
      subjects={data.subjectMinutes}
      subjectsTotalLabel={`${formatMinutes(data.totalMinutes)} total this week`}
      subjectsEmptyLabel="No study time logged this week."
      workoutSummaryLabel={
        data.workoutSessionCount === 0
          ? "No workouts logged this week."
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
      "Content-Disposition": `attachment; filename="proudly-weekly-recap-${data.startISO}.pdf"`,
    },
  });
}
