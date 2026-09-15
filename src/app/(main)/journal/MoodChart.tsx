import { monthGridDays, formatMonth, monthISOOf } from "@/lib/dates";
import { moodFace } from "@/lib/mood";

type Entry = { dateISO: string; mood: number | null };

const WIDTH = 700;
const CHART_HEIGHT = 170;
const LABEL_HEIGHT = 20;
const HEIGHT = CHART_HEIGHT + LABEL_HEIGHT;
const PAD_X = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 8;

function moodY(mood: number): number {
  const usable = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  return PAD_TOP + usable * (1 - (mood - 1) / 4);
}

// Catmull-Rom through the given points, converted to cubic bezier segments —
// gives a smoothly interlinking curve instead of straight jagged segments,
// without needing a charting library for one small line.
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function MoodChart({ monthISO, entries, today }: { monthISO: string; entries: Entry[]; today: string }) {
  const moodByDate = new Map(entries.filter((e) => e.mood != null).map((e) => [e.dateISO, e.mood as number]));
  const daysInMonth = monthGridDays(monthISO).filter((d) => monthISOOf(d) === monthISO);

  const values = [...moodByDate.values()];
  const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  const step = daysInMonth.length > 1 ? (WIDTH - PAD_X * 2) / (daysInMonth.length - 1) : 0;
  const points = daysInMonth.map((dateISO, i) => {
    const mood = moodByDate.get(dateISO);
    return { dateISO, x: PAD_X + i * step, y: mood != null ? moodY(mood) : null, mood };
  });

  // Connect every logged day in order, skipping over days with no entry —
  // a lone entry with days of silence on either side should still link up
  // to its neighbours instead of floating as an unconnected dot.
  const logged = points.filter((p): p is { dateISO: string; x: number; y: number; mood: number } => p.y != null);

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-muted">Mood in {formatMonth(monthISO)}</h2>
        {average !== null && (
          <span className="text-sm text-ink-muted">
            Average <span className="font-medium text-calm">{average.toFixed(1)}</span> {moodFace(Math.round(average))}
          </span>
        )}
      </div>
      {values.length === 0 ? (
        <p className="text-sm text-ink-muted">No moods logged yet this month.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block w-full h-auto">
            {/* Faint reference lines for the 5 mood levels */}
            {[1, 2, 3, 4, 5].map((m) => (
              <line
                key={m}
                x1={PAD_X}
                x2={WIDTH - PAD_X}
                y1={moodY(m)}
                y2={moodY(m)}
                stroke="var(--line)"
                strokeWidth="1"
              />
            ))}

            {logged.length > 1 &&
              (() => {
                const path = smoothPath(logged);
                const baseline = CHART_HEIGHT - PAD_BOTTOM;
                const areaPath = `${path} L ${logged[logged.length - 1].x} ${baseline} L ${logged[0].x} ${baseline} Z`;
                return (
                  <g>
                    <path d={areaPath} fill="var(--calm-soft)" opacity="0.6" />
                    <path d={path} fill="none" stroke="var(--calm)" strokeWidth="2.5" strokeLinecap="round" />
                  </g>
                );
              })()}

            {points.map(
              (p) =>
                p.y != null && (
                  <circle
                    key={p.dateISO}
                    cx={p.x}
                    cy={p.y}
                    r={p.dateISO === today ? 5 : 3.5}
                    fill="var(--calm)"
                    stroke="var(--card)"
                    strokeWidth="1.5"
                  >
                    <title>{`${p.dateISO} — ${moodFace(p.mood!)}`}</title>
                  </circle>
                ),
            )}

            {points.map((p, i) => {
              // Every day at the start, otherwise thin out so labels don't
              // collide on months with 30+ days.
              if (i !== 0 && i % 5 !== 0) return null;
              return (
                <text
                  key={p.dateISO}
                  x={p.x}
                  y={CHART_HEIGHT + LABEL_HEIGHT - 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--ink-muted)"
                >
                  {Number(p.dateISO.slice(8, 10))}
                </text>
              );
            })}
          </svg>
        </>
      )}
    </div>
  );
}
