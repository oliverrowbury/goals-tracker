"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  startStudySession,
  pauseStudySession,
  resumeStudySession,
  finishStudySession,
  deleteStudySession,
  createSubject,
} from "./actions";
import { formatMinutes } from "@/lib/study";
import { ClockIcon, PlayIcon, TrashIcon } from "@/components/Icons";

function AddSubjectForm({ onAdded }: { onAdded: () => void }) {
  const [state, formAction, isPending] = useActionState(createSubject, null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) onAdded();
    wasPending.current = isPending;
  }, [isPending, state, onAdded]);

  return (
    <div className="mt-3">
      <form ref={formRef} action={formAction} className="flex gap-2">
        <input
          name="name"
          autoFocus
          required
          placeholder="e.g. Further Maths"
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm focus:border-study focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-study px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {state?.error && <p className="mt-1.5 text-xs text-accent">{state.error}</p>}
    </div>
  );
}

type Subject = { id: string; name: string; color: string };
type OpenSession = { id: string; subjectId: string; startedAt: string; pausedAt: string | null } | null;

// Tab hidden this long while a session is running auto-pauses it. This is
// a safety net for "started the timer and forgot about it," not a claim
// that it can verify you're actually studying — tab visibility alone can't
// tell that apart from reading a PDF in another tab, watching a lecture
// video, or studying from a physical book with the phone timer running.
// So the threshold is long: minutes, not seconds, to avoid punishing
// normal cross-tab studying.
const AUTO_PAUSE_AFTER_MS = 10 * 60_000;

function useElapsedSeconds(startedAt: string | null, pausedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt || pausedAt) return; // frozen while paused
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt, pausedAt]);
  if (!startedAt) return 0;
  const end = pausedAt ? new Date(pausedAt).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000));
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
  const [autoPaused, setAutoPaused] = useState(false);
  const elapsedSeconds = useElapsedSeconds(openSession?.startedAt ?? null, openSession?.pausedAt ?? null);

  const activeSubject = subjects.find((s) => s.id === openSession?.subjectId);
  const isRunning = !!openSession && !openSession.pausedAt;
  const isPaused = !!openSession && !!openSession.pausedAt;

  // Anti-idle: if the tab is hidden while a session is running, auto-pause
  // it after a grace period. This can't prove you're actually studying, but
  // it stops the clock from running unattended in a backgrounded tab.
  const hiddenSinceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isRunning || !openSession) return;
    const sessionId = openSession.id;

    function handleVisibilityChange() {
      if (document.hidden) {
        hiddenSinceRef.current = Date.now();
        setTimeout(() => {
          if (hiddenSinceRef.current && Date.now() - hiddenSinceRef.current >= AUTO_PAUSE_AFTER_MS && document.hidden) {
            setAutoPaused(true);
            startTransition(() => pauseStudySession(sessionId));
          }
        }, AUTO_PAUSE_AFTER_MS + 200);
      } else {
        hiddenSinceRef.current = null;
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isRunning, openSession]);

  return (
    <div className="space-y-8">
      {openSession && activeSubject ? (
        <div className="rounded-2xl border border-line bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-ink-muted">{isPaused ? "Paused" : "Studying"}</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-ink">{activeSubject.name}</p>
          <p className={`mt-3 font-mono text-4xl tabular-nums ${isPaused ? "text-ink-muted" : "text-study"}`}>
            {formatClock(elapsedSeconds)}
          </p>
          {isPaused && autoPaused && (
            <p className="mt-2 text-xs text-ink-muted">Paused automatically — this tab was in the background a while.</p>
          )}
          <div className="mt-5 flex items-center justify-center gap-2">
            {isRunning && (
              <button
                disabled={isPending}
                onClick={() => {
                  setAutoPaused(false);
                  startTransition(() => pauseStudySession(openSession.id));
                }}
                className="rounded-lg border border-line px-5 py-2 text-sm font-medium text-ink hover:border-study disabled:opacity-50"
              >
                Pause
              </button>
            )}
            {isPaused && (
              <button
                disabled={isPending}
                onClick={() => {
                  setAutoPaused(false);
                  startTransition(() => resumeStudySession(openSession.id));
                }}
                className="rounded-lg bg-study px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Resume
              </button>
            )}
            <button
              disabled={isPending}
              onClick={() => startTransition(() => finishStudySession(openSession.id))}
              className="rounded-lg bg-ink px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Finish
            </button>
          </div>
          <button
            disabled={isPending}
            onClick={() => {
              if (confirm("Discard this session? It won't be saved anywhere — use Finish instead if you want to keep it.")) {
                startTransition(() => deleteStudySession(openSession.id));
              }
            }}
            className="mt-4 flex items-center gap-1 text-xs text-ink-muted hover:text-accent disabled:opacity-50 mx-auto"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Started by accident? Discard it
          </button>
        </div>
      ) : (
        <div>
          <h2 className="mb-1 text-sm font-medium text-ink-muted">Start a session</h2>
          <p className="mb-3 text-xs text-ink-muted">Tap a subject below to start timing it.</p>
          <div className="flex flex-wrap gap-2.5">
            {subjects.map((subject) => (
              <button
                key={subject.id}
                disabled={isPending}
                onClick={() => startTransition(() => startStudySession(subject.id))}
                className="group flex items-center gap-2 rounded-xl border border-line bg-card py-2.5 pl-2 pr-4 text-sm text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-study hover:shadow-md disabled:opacity-50"
                style={{ borderLeftColor: subject.color, borderLeftWidth: 4 }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-study-soft text-study transition group-hover:bg-study group-hover:text-white">
                  <PlayIcon className="h-3.5 w-3.5" />
                </span>
                {subject.name}
              </button>
            ))}
            <button
              onClick={() => setAddingSubject((v) => !v)}
              className="rounded-xl border border-dashed border-line px-3.5 py-2.5 text-sm text-ink-muted hover:border-study hover:text-study"
            >
              + Subject
            </button>
          </div>
          {addingSubject && <AddSubjectForm onAdded={() => setAddingSubject(false)} />}
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
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {subjects.map((subject) => {
              const minutes = weekTotals[subject.id] ?? 0;
              const isActive = subject.id === openSession?.subjectId;
              const liveMinutes = isActive ? minutes + Math.floor(elapsedSeconds / 60) : minutes;
              return (
                <li key={subject.id} className="flex items-center justify-between px-3.5 py-2 text-sm">
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
