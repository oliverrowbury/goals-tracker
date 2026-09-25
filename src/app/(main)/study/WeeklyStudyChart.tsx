"use client";

import { useState } from "react";
import { formatMinutes } from "@/lib/study";
import { weekdayShort, weekdayShortDayMonth } from "@/lib/dates";
import { ChartIcon } from "@/components/Icons";

type Subject = { id: string; name: string; color: string };
type Day = { dateISO: string; totalsBySubject: Record<string, number> };

const BAR_MAX_PX = 112; // matches the mark spec's <=24px-thick columns given 7 of them in a card-width row

// The week-at-a-glance stacked column chart — one bar per day, segmented by
// subject, the classic "how did this week actually go" view that the plain
// per-subject ranked bars below it (StudyStats) don't answer on their own
// (those total up a whole period; this shows the day-by-day shape of it).
export function WeeklyStudyChart({ subjects, days, todayISO }: { subjects: Subject[]; days: Day[]; todayISO: string }) {
  const [active, setActive] = useState<{ day: string; subjectId: string } | null>(null);

  const subjectsWithData = subjects.filter((s) => days.some((d) => (d.totalsBySubject[s.id] ?? 0) > 0));
  const dayTotals = days.map((d) => Object.values(d.totalsBySubject).reduce((sum, m) => sum + m, 0));
  const scaleMax = Math.max(1, ...dayTotals);
  const weekTotal = dayTotals.reduce((sum, m) => sum + m, 0);

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink-muted">
          <ChartIcon className="h-4 w-4 text-study" />
          This week
        </h2>
        <span className="text-xs text-ink-muted">{formatMinutes(weekTotal)} total</span>
      </div>

      {weekTotal === 0 ? (
        <p className="text-sm text-ink-muted">No study time logged this week yet.</p>
      ) : (
        <>
          {subjectsWithData.length > 1 && (
            <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1.5">
              {subjectsWithData.map((s) => (
                <span key={s.id} className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end justify-between gap-2">
            {days.map((day) => {
              const total = Object.values(day.totalsBySubject).reduce((sum, m) => sum + m, 0);
              const isToday = day.dateISO === todayISO;
              const segments = subjectsWithData
                .map((s) => ({ subject: s, minutes: day.totalsBySubject[s.id] ?? 0 }))
                .filter((seg) => seg.minutes > 0);

              return (
                <div key={day.dateISO} className="flex flex-1 flex-col items-center gap-1.5">
                  <p className="h-4 text-[11px] font-medium tabular-nums text-ink-muted">
                    {total > 0 ? formatMinutes(total) : ""}
                  </p>
                  <div
                    className="flex w-full max-w-6 flex-col-reverse gap-[2px] border-b border-line"
                    style={{ height: BAR_MAX_PX }}
                  >
                    {segments.length === 0 ? (
                      <div className="h-1 w-full rounded-full bg-line" />
                    ) : (
                      segments.map((seg) => {
                        const isActive = active?.day === day.dateISO && active.subjectId === seg.subject.id;
                        return (
                          <button
                            key={seg.subject.id}
                            type="button"
                            title={`${seg.subject.name}: ${formatMinutes(seg.minutes)} on ${weekdayShortDayMonth(day.dateISO)}`}
                            onMouseEnter={() => setActive({ day: day.dateISO, subjectId: seg.subject.id })}
                            onMouseLeave={() => setActive((a) => (a?.day === day.dateISO && a.subjectId === seg.subject.id ? null : a))}
                            onFocus={() => setActive({ day: day.dateISO, subjectId: seg.subject.id })}
                            onBlur={() => setActive((a) => (a?.day === day.dateISO && a.subjectId === seg.subject.id ? null : a))}
                            className="relative w-full shrink-0 last:rounded-t-[4px] focus:outline-none"
                            style={{
                              height: `${Math.max(3, (seg.minutes / scaleMax) * BAR_MAX_PX)}px`,
                              backgroundColor: seg.subject.color,
                              opacity: isActive ? 1 : 0.92,
                              filter: isActive ? "brightness(1.08)" : undefined,
                            }}
                          >
                            {isActive && (
                              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max max-w-40 -translate-x-1/2 rounded-lg bg-ink-solid px-2.5 py-1.5 text-center text-[11px] leading-tight text-white shadow-lg">
                                <span className="font-medium">{formatMinutes(seg.minutes)}</span>
                                <span className="block text-white/70">{seg.subject.name}</span>
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <p className={`text-[11px] ${isToday ? "font-semibold text-study" : "text-ink-muted"}`}>
                    {weekdayShort(day.dateISO)}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
