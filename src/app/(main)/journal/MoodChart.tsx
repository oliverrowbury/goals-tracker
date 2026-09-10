import { monthGridDays, formatMonth, monthISOOf, todayISO } from "@/lib/dates";
import { moodFace } from "@/lib/mood";

type Entry = { dateISO: string; mood: number | null };

export function MoodChart({ monthISO, entries }: { monthISO: string; entries: Entry[] }) {
  const moodByDate = new Map(entries.filter((e) => e.mood != null).map((e) => [e.dateISO, e.mood as number]));
  const daysInMonth = monthGridDays(monthISO).filter((d) => monthISOOf(d) === monthISO);
  const today = todayISO();

  const values = [...moodByDate.values()];
  const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

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
        <div className="flex items-end gap-[3px]" style={{ height: 64 }}>
          {daysInMonth.map((dateISO) => {
            const mood = moodByDate.get(dateISO);
            const isFuture = dateISO > today;
            return (
              <div
                key={dateISO}
                title={`${dateISO}${mood ? ` — ${moodFace(mood)}` : ""}`}
                className={`flex-1 rounded-sm ${mood ? "bg-calm" : isFuture ? "" : "bg-line"}`}
                style={{ height: mood ? `${(mood / 5) * 100}%` : isFuture ? 0 : 4, opacity: mood ? 0.35 + mood * 0.13 : 1 }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
