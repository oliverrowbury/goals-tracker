"use client";

import { useEffect, useState, useTransition } from "react";
import { startStudySession, stopStudySession, createSubject } from "./actions";
import { formatMinutes } from "@/lib/study";
import { ClockIcon } from "@/components/Icons";

type Subject = { id: string; name: string; color: string };
type OpenSession = { id: string; subjectId: string; startedAt: string } | null;

function useTicker(startedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  if (!startedAt) return 0;
  return Math.floor((now - new Date(startedAt).getTime()) / 1000);
}

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function StudyTimer({
  subjects,
  openSession,
  weekTotals,
}: {
  subjects: Subject[];
  openSession: OpenSession;
  weekTotals: Record<string, number>;
}) {
  const [isPending, startTransition] = useTransition();
  const [addingSubject, setAddingSubject] = useState(false);
  const elapsedSeconds = useTicker(openSession?.startedAt ?? null);

  const activeSubject = subjects.find((s) => s.id === openSession?.subjectId);

  return (
    <div className="space-y-8">
      {openSession && activeSubject ? (
        <div className="rounded-2xl border border-line bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-ink-muted">Studying</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-ink">{activeSubject.name}</p>
          <p className="mt-3 font-mono text-4xl tabular-nums text-study">{formatClock(elapsedSeconds)}</p>
          <button
            disabled={isPending}
            onClick={() => startTransition(() => stopStudySession(openSession.id))}
            className="mt-5 rounded-lg bg-study px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Stop
          </button>
        </div>
      ) : (
        <div>
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Start a session</h2>
          <div className="flex flex-wrap gap-2">
            {subjects.map((subject) => (
              <button
                key={subject.id}
                disabled={isPending}
                onClick={() => startTransition(() => startStudySession(subject.id))}
                className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm text-ink hover:border-study disabled:opacity-50"
                style={{ borderLeftColor: subject.color, borderLeftWidth: 3 }}
              >
                {subject.name}
              </button>
            ))}
            <button
              onClick={() => setAddingSubject((v) => !v)}
              className="rounded-lg border border-dashed border-line px-3.5 py-2 text-sm text-ink-muted hover:border-study hover:text-study"
            >
              + Subject
            </button>
          </div>
          {addingSubject && (
            <form
              action={(formData) => {
                startTransition(() => createSubject(formData));
                setAddingSubject(false);
              }}
              className="mt-3 flex gap-2"
            >
              <input
                name="name"
                autoFocus
                required
                placeholder="e.g. Further Maths"
                className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm focus:border-study focus:outline-none"
              />
              <button type="submit" className="rounded-lg bg-study px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
                Add
              </button>
            </form>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-ink-muted">This week</h2>
        {subjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-8 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-study-soft text-study">
              <ClockIcon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm text-ink-muted">Add a subject above to start tracking.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {subjects.map((subject) => {
              const minutes = weekTotals[subject.id] ?? 0;
              const isActive = subject.id === openSession?.subjectId;
              const liveMinutes = isActive ? minutes + Math.floor(elapsedSeconds / 60) : minutes;
              return (
                <li
                  key={subject.id}
                  className="flex items-center justify-between rounded-lg border border-line bg-card px-3.5 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 text-ink">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subject.color }} />
                    {subject.name}
                  </span>
                  <span className={isActive ? "font-medium text-study" : "text-ink-muted"}>
                    {formatMinutes(liveMinutes)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
