"use client";

import { useState } from "react";
import { fromKg, formatWeight } from "@/lib/workout";
import { weekdayShortDayMonth } from "@/lib/dates";
import type { WeightUnit } from "@/lib/constants";

type ProgressPoint = { dateISO: string; weightKg: number; reps: number; estOneRmKg: number };
type ExerciseSeries = { exerciseId: string; exerciseName: string; points: ProgressPoint[] };

const WIDTH = 700;
const HEIGHT = 180;
const PAD_X = 14;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;

// A plain line chart of estimated 1RM over time for one exercise — same
// hand-rolled inline-SVG approach as the journal's MoodChart, since a full
// charting library is overkill for one line.
export function ExerciseProgress({ exercises, weightUnit }: { exercises: ExerciseSeries[]; weightUnit: WeightUnit }) {
  const [exerciseId, setExerciseId] = useState(exercises[0]?.exerciseId ?? "");
  const series = exercises.find((e) => e.exerciseId === exerciseId) ?? exercises[0];
  if (!series) return null;

  const points = series.points;
  const displayPoints = points.map((p) => ({
    ...p,
    displayWeight: fromKg(p.weightKg, weightUnit),
    displayOneRm: fromKg(p.estOneRmKg, weightUnit),
  }));

  const maxOneRm = Math.max(...displayPoints.map((p) => p.displayOneRm), 1);
  const minOneRm = Math.min(...displayPoints.map((p) => p.displayOneRm), maxOneRm);
  // A little headroom so the top point's dot isn't clipped, and a floor of
  // 0 rather than the data's own minimum, so the line's climb reads as
  // "how much I lift," not an exaggerated wiggle around a tight band.
  const yMax = maxOneRm * 1.1;
  const yMin = 0;
  const usableHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const yFor = (v: number) => PAD_TOP + usableHeight * (1 - (v - yMin) / (yMax - yMin || 1));

  const step = displayPoints.length > 1 ? (WIDTH - PAD_X * 2) / (displayPoints.length - 1) : 0;
  const coords = displayPoints.map((p, i) => ({ ...p, x: PAD_X + i * step, y: yFor(p.displayOneRm) }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

  const best = displayPoints.reduce((a, b) => (b.displayOneRm > a.displayOneRm ? b : a), displayPoints[0]);

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-ink-muted">Progress</h2>
        <select
          value={series.exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
          className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-workout focus:outline-none"
        >
          {exercises.map((e) => (
            <option key={e.exerciseId} value={e.exerciseId}>
              {e.exerciseName}
            </option>
          ))}
        </select>
      </div>

      {points.length < 2 ? (
        <p className="text-sm text-ink-muted">
          Log this exercise on a couple more days to see progress over time.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-ink-muted">
            Best: <span className="font-medium text-workout">{formatWeight(best.weightKg, weightUnit)}</span> ×{" "}
            {best.reps} on {weekdayShortDayMonth(best.dateISO)}
            {best.reps > 1 && ` · est. 1RM ${formatWeight(best.estOneRmKg, weightUnit)}`}
          </p>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full">
            <line x1={PAD_X} x2={WIDTH - PAD_X} y1={yFor(yMin)} y2={yFor(yMin)} stroke="var(--line)" strokeWidth="1" />
            <path d={linePath} fill="none" stroke="var(--workout)" strokeWidth="2.5" strokeLinecap="round" />
            {coords.map((c) => (
              <circle key={c.dateISO} cx={c.x} cy={c.y} r={3.5} fill="var(--workout)" stroke="var(--card)" strokeWidth="1.5">
                <title>
                  {c.dateISO}: {formatWeight(c.weightKg, weightUnit)} × {c.reps}
                </title>
              </circle>
            ))}
          </svg>
        </>
      )}
    </div>
  );
}
