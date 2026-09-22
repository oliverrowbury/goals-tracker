"use client";

import { useState } from "react";
import { fromKg, formatWeight } from "@/lib/workout";
import { weekdayShortDayMonth, shortDayMonth } from "@/lib/dates";
import { smoothPath } from "@/lib/charts";
import type { WeightUnit } from "@/lib/constants";
import { Select } from "@/components/Select";

type ProgressPoint = { dateISO: string; weightKg: number; reps: number; estOneRmKg: number };
type ExerciseSeries = { exerciseId: string; exerciseName: string; points: ProgressPoint[] };

const WIDTH = 700;
const CHART_HEIGHT = 170;
const LABEL_HEIGHT = 20;
const HEIGHT = CHART_HEIGHT + LABEL_HEIGHT;
const PAD_X = 14;
const PAD_TOP = 18;
const PAD_BOTTOM = 8;

// A line chart of estimated 1RM over time for one exercise — same
// hand-rolled inline-SVG approach as the journal's MoodChart (gridlines
// with value labels, a filled area under a smoothed curve, and thinned
// date labels along the bottom), rather than the bare unlabeled line this
// used to be, which read as a jagged squiggle with no context for what it
// was even showing.
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
  // A little headroom so the top point's dot isn't clipped, and a floor of
  // 0 rather than the data's own minimum, so the line's climb reads as
  // "how much I lift," not an exaggerated wiggle around a tight band.
  const yMax = maxOneRm * 1.15;
  const yMin = 0;
  const usableHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const yFor = (v: number) => PAD_TOP + usableHeight * (1 - (v - yMin) / (yMax - yMin || 1));

  const step = displayPoints.length > 1 ? (WIDTH - PAD_X * 2) / (displayPoints.length - 1) : 0;
  const coords = displayPoints.map((p, i) => ({ ...p, x: PAD_X + i * step, y: yFor(p.displayOneRm) }));

  const best = displayPoints.reduce((a, b) => (b.displayOneRm > a.displayOneRm ? b : a), displayPoints[0]);
  const bestIndex = coords.findIndex((c) => c.dateISO === best.dateISO);

  // Three reference gridlines (floor, midpoint, ceiling), each labeled with
  // its 1RM value on the left — MoodChart has the same faint-lines idea but
  // didn't need value labels since mood is already self-explanatory (1-5);
  // a weight chart isn't, without them.
  const gridValues = [yMin, yMax / 2, yMax];

  // Thin the x-axis labels so they don't collide once there's more than a
  // handful of points — always keep the first and last so the date range
  // itself is legible, same convention MoodChart uses for a month's worth
  // of days.
  const labelEvery = Math.max(1, Math.ceil(coords.length / 6));

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-ink-muted">Progress</h2>
        <Select
          value={series.exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
          className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-workout focus:outline-none"
        >
          {exercises.map((e) => (
            <option key={e.exerciseId} value={e.exerciseId}>
              {e.exerciseName}
            </option>
          ))}
        </Select>
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
            {gridValues.map((v, i) => (
              <g key={i}>
                <line x1={PAD_X} x2={WIDTH - PAD_X} y1={yFor(v)} y2={yFor(v)} stroke="var(--line)" strokeWidth="1" />
                <text x={PAD_X} y={yFor(v) - 4} fontSize="10" fill="var(--ink-muted)">
                  {Math.round(v)}
                </text>
              </g>
            ))}

            {(() => {
              const path = smoothPath(coords);
              const baseline = yFor(yMin);
              const areaPath = `${path} L ${coords[coords.length - 1].x} ${baseline} L ${coords[0].x} ${baseline} Z`;
              return (
                <g>
                  <path d={areaPath} fill="var(--workout-soft)" opacity="0.6" />
                  <path d={path} fill="none" stroke="var(--workout)" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              );
            })()}

            {coords.map((c, i) => (
              <circle
                key={c.dateISO}
                cx={c.x}
                cy={c.y}
                r={i === bestIndex ? 5 : 3.5}
                fill="var(--workout)"
                stroke="var(--card)"
                strokeWidth="1.5"
              >
                <title>{`${c.dateISO}: ${formatWeight(c.weightKg, weightUnit)} × ${c.reps}`}</title>
              </circle>
            ))}

            {coords.map((c, i) => {
              if (i !== 0 && i !== coords.length - 1 && i % labelEvery !== 0) return null;
              return (
                <text
                  key={c.dateISO}
                  x={c.x}
                  y={CHART_HEIGHT + LABEL_HEIGHT - 4}
                  textAnchor={i === 0 ? "start" : i === coords.length - 1 ? "end" : "middle"}
                  fontSize="10"
                  fill="var(--ink-muted)"
                >
                  {shortDayMonth(c.dateISO)}
                </text>
              );
            })}
          </svg>
        </>
      )}
    </div>
  );
}
