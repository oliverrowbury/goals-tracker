import { renderToBuffer } from "@react-pdf/renderer";
import { formatWeekRange, formatMonth } from "@/lib/dates";
import { formatMinutes } from "@/lib/study";
import { formatDistance } from "@/lib/workout";
import { getWeeklyRecapData } from "@/app/(main)/WeeklyRecap";
import { getMonthlyRecapData } from "@/app/(main)/MonthlyRecap";
import { getYearlyRecapData } from "@/app/(main)/YearlyRecap";
import { RecapDocument } from "./RecapDocument";
import type { DistanceUnit } from "@/lib/constants";

// Shared by the on-demand export routes (api/export/recap/*) and the
// Premium recap-email cron phase (api/cron/weekly-recap, monthly-recap) —
// one place for the prop-mapping that used to be copy-pasted three times.

function generatedAtLabel(): string {
  return `Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

function workoutSummaryLabel(
  data: { workoutSessionCount: number; workoutMinutes: number; cardioKm: number },
  periodWord: string,
  distanceUnit: DistanceUnit,
): string {
  if (data.workoutSessionCount === 0) return `No workouts logged this ${periodWord}.`;
  return `${data.workoutSessionCount} session${data.workoutSessionCount === 1 ? "" : "s"} · ${formatMinutes(data.workoutMinutes)} total${
    data.cardioKm > 0 ? ` · ${formatDistance(data.cardioKm, distanceUnit)} covered` : ""
  }`;
}

export type BuiltRecapPdf = { pdf: Buffer; filename: string; isEmpty: boolean };

export async function buildWeeklyRecapPdf(userId: string, weekISO: string, distanceUnit: DistanceUnit): Promise<BuiltRecapPdf> {
  const data = await getWeeklyRecapData(userId, weekISO);
  const isEmpty = data.goalSummaries.length === 0 && data.subjectMinutes.length === 0 && data.workoutSessionCount === 0;

  const pdf = await renderToBuffer(
    <RecapDocument
      title={`Week of ${formatWeekRange(data.startISO, data.endISO)}`}
      subtitle="Weekly recap"
      goals={data.goalSummaries}
      goalsEmptyLabel="No goals due this week."
      subjects={data.subjectMinutes}
      subjectsTotalLabel={`${formatMinutes(data.totalMinutes)} total this week`}
      subjectsEmptyLabel="No study time logged this week."
      workoutSummaryLabel={workoutSummaryLabel(data, "week", distanceUnit)}
      generatedAtLabel={generatedAtLabel()}
    />,
  );

  return { pdf: Buffer.from(pdf), filename: `proudly-weekly-recap-${data.startISO}.pdf`, isEmpty };
}

export async function buildMonthlyRecapPdf(userId: string, monthISO: string, distanceUnit: DistanceUnit): Promise<BuiltRecapPdf> {
  const data = await getMonthlyRecapData(userId, monthISO);
  const isEmpty = data.goalSummaries.length === 0 && data.subjectMinutes.length === 0 && data.workoutSessionCount === 0;

  const pdf = await renderToBuffer(
    <RecapDocument
      title={formatMonth(data.monthISO)}
      subtitle="Monthly recap"
      goals={data.goalSummaries}
      goalsEmptyLabel="No goals due this month."
      subjects={data.subjectMinutes}
      subjectsTotalLabel={`${formatMinutes(data.totalMinutes)} total this month`}
      subjectsEmptyLabel="No study time logged this month."
      workoutSummaryLabel={workoutSummaryLabel(data, "month", distanceUnit)}
      generatedAtLabel={generatedAtLabel()}
    />,
  );

  return { pdf: Buffer.from(pdf), filename: `proudly-monthly-recap-${data.monthISO}.pdf`, isEmpty };
}

export async function buildYearlyRecapPdf(userId: string, year: number, distanceUnit: DistanceUnit): Promise<BuiltRecapPdf> {
  const data = await getYearlyRecapData(userId, year);
  const isEmpty = data.journalEntryCount === 0 && data.goalsCompletedCount === 0 && data.subjectMinutes.length === 0 && data.workoutSessionCount === 0;

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
      workoutSummaryLabel={workoutSummaryLabel(data, "year", distanceUnit)}
      generatedAtLabel={generatedAtLabel()}
    />,
  );

  return { pdf: Buffer.from(pdf), filename: `proudly-yearly-recap-${data.year}.pdf`, isEmpty };
}
