"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  startStudySession,
  pauseStudySession,
  resumeStudySession,
  finishStudySession,
  deleteStudySession,
  createSubject,
  logManualSession,
} from "./actions";
import { formatMinutes } from "@/lib/study";
import { todayISO, shiftISO } from "@/lib/dates";
import { useClockOffsetMs } from "@/lib/time";
import { ClockIcon, PlayIcon, TrashIcon } from "@/components/Icons";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Select } from "@/components/Select";
import { StudySummary, type JustFinishedSession } from "./StudySummary";

type Subject = { id: string; name: string; color: string };

function ManualEntryForm({ subjects, onDone }: { subjects: Subject[]; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(logManualSession, null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) onDone();
    wasPending.current = isPending;
  }, [isPending, state, onDone]);

  return (
    <form ref={formRef} action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-ink-muted" htmlFor="manual-subject">
          Subject
        </label>
        <Select
          id="manual-subject"
          name="subjectId"
          required
          className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm focus:border-study focus:outline-none"
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted" htmlFor="manual-minutes">
          Minutes
        </label>
        <input
          id="manual-minutes"
          name="minutes"
          type="number"
          min="1"
          step="1"
          required
          placeholder="30"
          className="w-20 rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm focus:border-study focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted" htmlFor="manual-date">
          Date
        </label>
        <input
          id="manual-date"
          name="date"
          type="date"
          required
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm focus:border-study focus:outline-none"
        />
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setDate(todayISO())}
          className={`rounded-lg border px-2.5 py-1.5 text-xs ${date === todayISO() ? "border-study bg-study-soft text-study" : "border-line text-ink-muted hover:border-study"}`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setDate(shiftISO(todayISO(), -1))}
          className={`rounded-lg border px-2.5 py-1.5 text-xs ${date === shiftISO(todayISO(), -1) ? "border-study bg-study-soft text-study" : "border-line text-ink-muted hover:border-study"}`}
        >
          Yesterday
        </button>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-study px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add"}
      </button>
      {state?.error && <p className="w-full text-xs text-accent">{state.error}</p>}
    </form>
  );
}

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

type OpenSession = { id: string; subjectId: string; startedAt: string; pausedAt: string | null } | null;

// Tab hidden this long while a session is running auto-pauses it. This is
// a safety net for "started the timer and forgot about it," not a claim
// that it can verify you're actually studying — tab visibility alone can't
// tell that apart from reading a PDF in another tab, watching a lecture
// video, or studying from a physical book with the phone timer running.
// So the threshold is long: minutes, not seconds, to avoid punishing
// normal cross-tab studying.
const AUTO_PAUSE_AFTER_MS = 10 * 60_000;

function useElapsedSeconds(startedAt: string | null, pausedAt: string | null, clockOffsetMs: number) {
  const [now, setNow] = useState(() => Date.now() - clockOffsetMs);
  useEffect(() => {
    if (!startedAt || pausedAt) return; // frozen while paused
    const interval = setInterval(() => setNow(Date.now() - clockOffsetMs), 1000);
    return () => clearInterval(interval);
  }, [startedAt, pausedAt, clockOffsetMs]);
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

const DEFAULT_WORK_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

export function StudyTimer({
  subjects,
  openSession,
  weekTotals,
  serverNow,
}: {
  subjects: Subject[];
  openSession: OpenSession;
  weekTotals: Record<string, number>;
  serverNow: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [addingSubject, setAddingSubject] = useState(false);
  const [addingManually, setAddingManually] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  // Tapping a subject only selects it — it doesn't start the timer yet.
  // Starting is its own deliberate action below, same as the workout
  // tracker's type picker, so a stray tap can't accidentally kick off a
  // timed session.
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const clockOffsetMs = useClockOffsetMs(serverNow);
  const elapsedSeconds = useElapsedSeconds(openSession?.startedAt ?? null, openSession?.pausedAt ?? null, clockOffsetMs);

  const activeSubject = subjects.find((s) => s.id === openSession?.subjectId);
  const isRunning = !!openSession && !openSession.pausedAt;
  const isPaused = !!openSession && !!openSession.pausedAt;

  // Pomodoro is a client-side layer on top of the same pause/resume actions
  // used above — a "work" interval ending calls pauseStudySession exactly
  // like the manual Pause button would, and a "break" ending calls
  // resumeStudySession. Nothing new is persisted; the session's own
  // startedAt/pausedAt already account for the paused break time correctly.
  const [pomodoroEnabled, setPomodoroEnabled] = useState(false);
  const [workMinutes, setWorkMinutes] = useState(DEFAULT_WORK_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [pomodoroPhase, setPomodoroPhase] = useState<"work" | "break">("work");
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(DEFAULT_WORK_MINUTES * 60);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const onPomodoroBreak = pomodoroEnabled && pomodoroPhase === "break";
  const openSessionId = openSession?.id ?? null;
  const [justFinished, setJustFinished] = useState<JustFinishedSession | null>(null);

  // A new/ended session always starts Pomodoro fresh and off, rather than
  // carrying over a stale phase/count from whatever was studied before.
  // Done during render (the React-recommended way to reset state when
  // something identity-like changes — see "Storing information from
  // previous renders" in the React docs) rather than an effect, so it
  // takes effect in the same render instead of causing an extra one.
  const [prevSessionId, setPrevSessionId] = useState(openSessionId);
  if (openSessionId !== prevSessionId) {
    setPrevSessionId(openSessionId);
    setPomodoroEnabled(false);
    setPomodoroPhase("work");
    setCompletedPomodoros(0);
    // A new session starting means any previous "just finished" summary is
    // stale — same reasoning as the workout tracker's equivalent reset.
    if (openSessionId) {
      setJustFinished(null);
      setSelectedSubjectId(null);
    }
  }

  // Ticks the current phase down once a second — work only while the
  // session is actually running (so a manual pause freezes it too, same as
  // the elapsed-time clock above), break always ticks since that time is
  // deliberately not counted as study time.
  useEffect(() => {
    if (!pomodoroEnabled || phaseSecondsLeft <= 0) return;
    const shouldTick = pomodoroPhase === "work" ? isRunning : true;
    if (!shouldTick) return;
    const timeout = setTimeout(() => setPhaseSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timeout);
  }, [pomodoroEnabled, pomodoroPhase, isRunning, phaseSecondsLeft]);

  // Fires exactly once when a phase's countdown reaches zero — separated
  // from the ticking effect above so the side effects here (pausing/
  // resuming the session) only ever run on that transition, not on every
  // second. Unlike the two state resets above, this genuinely belongs in
  // an effect rather than during render: it's reacting to time passing
  // (not a prop/input changing) and has to call a server action, which
  // render can't do.
  useEffect(() => {
    if (!pomodoroEnabled || phaseSecondsLeft > 0 || !openSessionId) return;
    if (pomodoroPhase === "work") {
      startTransition(() => pauseStudySession(openSessionId));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPomodoroPhase("break");
      setPhaseSecondsLeft(breakMinutes * 60);
    } else {
      startTransition(() => resumeStudySession(openSessionId));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPomodoroPhase("work");
      setPhaseSecondsLeft(workMinutes * 60);
      setCompletedPomodoros((c) => c + 1);
    }
  }, [phaseSecondsLeft, pomodoroEnabled, pomodoroPhase, openSessionId, breakMinutes, workMinutes]);

  function togglePomodoro() {
    const next = !pomodoroEnabled;
    setPomodoroEnabled(next);
    if (next) {
      // Always starts on a fresh work interval — an event handler, not an
      // effect, so this can just set state directly.
      setPomodoroPhase("work");
      setPhaseSecondsLeft(workMinutes * 60);
    } else if (onPomodoroBreak && openSessionId) {
      // Turning it off mid-break shouldn't leave the session stuck paused.
      startTransition(() => resumeStudySession(openSessionId));
    }
  }

  function skipBreak() {
    if (!openSessionId) return;
    startTransition(() => resumeStudySession(openSessionId));
    setPomodoroPhase("work");
    setPhaseSecondsLeft(workMinutes * 60);
    setCompletedPomodoros((c) => c + 1);
  }

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
      {!openSession && justFinished && <StudySummary session={justFinished} onDone={() => setJustFinished(null)} />}

      {openSession && activeSubject ? (
        <div className="rounded-2xl border border-line bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-ink-muted">{onPomodoroBreak ? "On a break" : isPaused ? "Paused" : "Studying"}</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-ink">{activeSubject.name}</p>
          <p className={`mt-3 font-mono text-4xl tabular-nums ${isPaused ? "text-ink-muted" : "text-study"}`}>
            {formatClock(elapsedSeconds)}
          </p>
          {isPaused && autoPaused && !pomodoroEnabled && (
            <p className="mt-2 text-xs text-ink-muted">Paused automatically — this tab was in the background a while.</p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <button
              type="button"
              onClick={togglePomodoro}
              className={`rounded-full border px-3 py-1 font-medium transition ${
                pomodoroEnabled ? "border-study bg-study-soft text-study" : "border-line text-ink-muted hover:border-study"
              }`}
            >
              🍅 Pomodoro {pomodoroEnabled ? "on" : "off"}
            </button>
            {!pomodoroEnabled && (
              <>
                <label className="flex items-center gap-1 text-ink-muted">
                  Work
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={workMinutes}
                    onChange={(e) => setWorkMinutes(Math.min(180, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-12 rounded border border-line bg-paper px-1 py-0.5 text-center focus:border-study focus:outline-none"
                  />
                  m
                </label>
                <label className="flex items-center gap-1 text-ink-muted">
                  Break
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-12 rounded border border-line bg-paper px-1 py-0.5 text-center focus:border-study focus:outline-none"
                  />
                  m
                </label>
              </>
            )}
            {pomodoroEnabled && (
              <span className="text-ink-muted">
                {pomodoroPhase === "work" ? "Work" : "Break"} · {formatClock(phaseSecondsLeft)} left
                {completedPomodoros > 0 && ` · ${completedPomodoros} done`}
              </span>
            )}
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            {onPomodoroBreak ? (
              <button
                disabled={isPending}
                onClick={skipBreak}
                className="rounded-lg bg-study px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Skip break
              </button>
            ) : (
              <>
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
              </>
            )}
            <button
              disabled={isPending}
              onClick={() => {
                setJustFinished({
                  id: openSession.id,
                  subjectName: activeSubject.name,
                  durationMinutes: Math.round(elapsedSeconds / 60),
                });
                startTransition(() => finishStudySession(openSession.id));
              }}
              className="rounded-lg bg-ink-solid px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Finish
            </button>
          </div>
          <ConfirmButton
            disabled={isPending}
            triggerClassName="mt-4 flex items-center gap-1 text-xs text-ink-muted hover:text-accent disabled:opacity-50 mx-auto"
            title="Discard this session?"
            message="It won't be saved anywhere — use Finish instead if you want to keep it."
            confirmLabel="Discard"
            onConfirm={() => deleteStudySession(openSession.id)}
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Started by accident? Discard it
          </ConfirmButton>
        </div>
      ) : (
        !justFinished && (
          <div>
            <h2 className="mb-1 text-sm font-medium text-ink-muted">Start a session</h2>
            <p className="mb-3 text-xs text-ink-muted">Tap a subject, then press Start.</p>
            <div className="flex flex-wrap gap-2.5">
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  disabled={isPending}
                  onClick={() => setSelectedSubjectId(subject.id)}
                  className={`group flex items-center gap-2 rounded-xl border py-2.5 pl-2 pr-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 ${
                    selectedSubjectId === subject.id
                      ? "border-study bg-study-soft text-study"
                      : "border-line bg-card text-ink hover:border-study"
                  }`}
                  style={{ borderLeftColor: subject.color, borderLeftWidth: 4 }}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                      selectedSubjectId === subject.id
                        ? "bg-study text-white"
                        : "bg-study-soft text-study group-hover:bg-study group-hover:text-white"
                    }`}
                  >
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
            {selectedSubjectId && (
              <button
                disabled={isPending}
                onClick={() => startTransition(() => startStudySession(selectedSubjectId))}
                className="mt-4 w-full rounded-xl bg-study py-3.5 text-base font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50 sm:w-auto sm:px-6"
              >
                Start {subjects.find((s) => s.id === selectedSubjectId)?.name}
              </button>
            )}
          </div>
        )
      )}

      {subjects.length > 0 && (
        <div>
          <button
            onClick={() => setAddingManually((v) => !v)}
            className="rounded-lg border border-dashed border-line px-3.5 py-2 text-sm text-ink-muted hover:border-study hover:text-study"
          >
            + Log time from earlier
          </button>
          {addingManually && <ManualEntryForm subjects={subjects} onDone={() => setAddingManually(false)} />}
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
