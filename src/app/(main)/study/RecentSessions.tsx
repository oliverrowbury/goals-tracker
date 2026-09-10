import { deleteStudySession } from "./actions";
import { formatMinutes } from "@/lib/study";
import { todayISO, shiftISO } from "@/lib/dates";

type Subject = { id: string; name: string; color: string };
type Session = { id: string; subjectId: string; durationMinutes: number | null; startedAt: string };

function dayLabel(startedAtISO: string): string {
  const dateISO = startedAtISO.slice(0, 10);
  const today = todayISO();
  if (dateISO === today) return "Today";
  if (dateISO === shiftISO(today, -1)) return "Yesterday";
  return new Date(startedAtISO).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
}

export function RecentSessions({ subjects, sessions }: { subjects: Subject[]; sessions: Session[] }) {
  if (sessions.length === 0) return null;

  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-ink-muted">Recent sessions</h2>
      <ul className="space-y-1.5">
        {sessions.map((session) => {
          const subject = subjectById.get(session.subjectId);
          return (
            <li
              key={session.id}
              className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3.5 py-2 text-sm text-ink"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: subject?.color ?? "#999" }} />
              {subject?.name ?? "Unknown subject"}
              <span className="text-ink-muted">— {formatMinutes(session.durationMinutes ?? 0)}</span>
              <span className="text-xs text-ink-muted">{dayLabel(session.startedAt)}</span>
              <form action={deleteStudySession.bind(null, session.id)} className="ml-auto">
                <button type="submit" title="Remove this session" className="text-ink-muted hover:text-accent">
                  ×
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
