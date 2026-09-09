"use client";

import { useState } from "react";
import { formatMinutes } from "@/lib/study";
import { ChartIcon } from "@/components/Icons";

type Subject = { id: string; name: string; color: string };
type Period = "day" | "week" | "month" | "year";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
};
const PERIOD_BUTTON_LABELS: Record<Period, string> = { day: "Day", week: "Week", month: "Month", year: "Year" };

export function StudyStats({
  subjects,
  totalsByPeriod,
}: {
  subjects: Subject[];
  totalsByPeriod: Record<Period, Record<string, number>>;
}) {
  const [period, setPeriod] = useState<Period>("day");

  const totals = totalsByPeriod[period];
  const rows = subjects
    .map((s) => ({ ...s, minutes: totals[s.id] ?? 0 }))
    .filter((s) => s.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  const grandTotal = rows.reduce((sum, r) => sum + r.minutes, 0);

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink-muted">
          <ChartIcon className="h-4 w-4 text-study" />
          Time by subject
        </h2>
        <div className="flex gap-1 text-xs">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-2.5 py-1 font-medium ${
                period === p ? "bg-study text-white" : "text-ink-muted hover:text-study"
              }`}
            >
              {PERIOD_BUTTON_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No study time logged {PERIOD_LABELS[period].toLowerCase()}.</p>
      ) : (
        <>
          <div className="space-y-2.5">
            {rows.map((row) => (
              <div key={row.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-ink">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                    {row.name}
                  </span>
                  <span className="text-ink-muted">{formatMinutes(row.minutes)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-line/40">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.max(4, (row.minutes / max) * 100)}%`, backgroundColor: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-muted">{formatMinutes(grandTotal)} total {PERIOD_LABELS[period].toLowerCase()}</p>
        </>
      )}
    </div>
  );
}
