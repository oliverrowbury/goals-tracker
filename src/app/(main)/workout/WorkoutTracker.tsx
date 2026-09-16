"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  startWorkout,
  addSet,
  removeSet,
  renameWorkout,
  updateWorkoutNote,
  updateWorkoutDetails,
  updateWorkoutSet,
  finishStrengthWorkout,
  finishCardioWorkout,
  deleteWorkout,
  createExercise,
} from "./actions";
import { formatMinutes } from "@/lib/study";
import {
  formatPace,
  formatDistance,
  formatWeight,
  fromKg,
  computeVolume,
  formatClock,
  fromKm,
  toKm,
  haversineKm,
  computeSplits,
  computeElevationGainM,
  type RoutePoint,
} from "@/lib/workout";
import { useClockOffsetMs } from "@/lib/time";
import { todayISO, shiftISO, weekdayShortDayMonth } from "@/lib/dates";
import { TrashIcon, DumbbellIcon, ActivityIcon, ChevronDownIcon } from "@/components/Icons";
import { CARDIO_ACTIVITIES, type WorkoutType, type WeightUnit, type DistanceUnit } from "@/lib/constants";
import { RouteMap } from "./RouteMap";
import { ShareButton } from "@/components/ShareButton";
import { WorkoutSummary, type JustFinishedWorkout } from "./WorkoutSummary";
import { EXERCISE_REFERENCE_IMAGE } from "@/lib/exerciseReference";

type Exercise = { id: string; name: string; category: string };
type SetRow = { id: string; exerciseId: string; setNumber: number; weight: number; reps: number; isWarmup: boolean };
type OpenWorkout = {
  id: string;
  type: WorkoutType;
  label: string;
  note: string | null;
  startedAt: string;
  sets: SetRow[];
} | null;
type LastPerformed = Record<string, { dateISO: string; sets: { weight: number; reps: number; isWarmup: boolean }[] }>;
type WeekSummary = { sessions: number; minutes: number; strengthCount: number; cardioCount: number; cardioKm: number };
type HistorySet = { id: string; exerciseName: string; weight: number; reps: number; isWarmup: boolean };
type HistoryWorkout = {
  id: string;
  type: WorkoutType;
  label: string;
  note: string | null;
  dateISO: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  route: RoutePoint[] | null;
  sets: HistorySet[];
};

function useElapsedSeconds(startedAt: string | null, clockOffsetMs: number): number {
  const [now, setNow] = useState(() => Date.now() - clockOffsetMs);
  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now() - clockOffsetMs), 1000);
    return () => clearInterval(interval);
  }, [startedAt, clockOffsetMs]);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

// A rest timer between sets, the way Hevy/Strong do it — one countdown for
// the whole workout (not per exercise, which would mean juggling several),
// started fresh each time any set is logged. Purely a client-side nicety:
// nothing here is persisted, so refreshing the page loses it, same as
// closing the app mid-rest in any gym app.
const DEFAULT_REST_SECONDS = 90;

function RestTimer({ endAt, onExtend, onDismiss }: { endAt: number; onExtend: (deltaSeconds: number) => void; onDismiss: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = Math.max(0, Math.ceil((endAt - now) / 1000));
  useEffect(() => {
    if (remaining === 0) {
      const t = setTimeout(onDismiss, 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining === 0]);

  const total = DEFAULT_REST_SECONDS;
  const pct = Math.min(100, Math.max(0, 100 * (1 - remaining / total)));

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-line bg-paper">
      <div className="h-1 bg-line">
        <div className="h-full bg-workout transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <p className="text-sm text-ink-muted">
          {remaining > 0 ? (
            <>
              Resting — <span className="font-mono font-medium tabular-nums text-ink">{formatClock(remaining)}</span>
            </>
          ) : (
            "Rest done — go again"
          )}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onExtend(-15)}
            className="rounded-lg border border-line px-2 py-1 text-xs text-ink-muted hover:border-workout hover:text-workout"
          >
            −15s
          </button>
          <button
            type="button"
            onClick={() => onExtend(15)}
            className="rounded-lg border border-line px-2 py-1 text-xs text-ink-muted hover:border-workout hover:text-workout"
          >
            +15s
          </button>
          <button type="button" onClick={onDismiss} className="rounded-lg px-2 py-1 text-ink-muted hover:text-accent" title="Skip rest">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

type GpsStatus = "idle" | "acquiring" | "tracking" | "denied" | "unsupported";

// A single bad GPS fix shouldn't wreck the total or make the drawn route
// look like static, so fixes are filtered three ways before being added:
// too-imprecise (a poor accuracy radius, common indoors or under tree
// cover), too-fast (an instant "jump" between two fixes implying a speed
// nothing on foot or a bike hits — almost always a glitch), and
// too-small (GPS jitter while standing still or moving very slowly —
// without this, a stationary phone draws a jagged little scribble instead
// of a clean line, since consecutive fixes never land on the exact same
// point even when nothing moved).
const MAX_GPS_ACCURACY_M = 25;
const MAX_PLAUSIBLE_SPEED_MPS = 12; // ~43km/h — generous enough for a hard bike leg
const MIN_MOVEMENT_M = 5; // below this, treat it as jitter rather than real movement

// Live-tracks distance and the route itself for a cardio session via the
// browser's geolocation API — a running total (see haversineKm) plus the
// accepted fixes in order, which is enough to draw a line on a map without
// needing a server round-trip per fix. Requires the tab to stay open and
// the OS to keep granting fixes; that's a real limitation on a locked
// phone in a pocket, not something this can paper over.
function useGpsTrack(active: boolean): { distanceKm: number; status: GpsStatus; points: RoutePoint[] } {
  const [distanceKm, setDistanceKm] = useState(0);
  const [status, setStatus] = useState<GpsStatus>(() =>
    typeof navigator !== "undefined" && "geolocation" in navigator ? "idle" : "unsupported",
  );
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const lastFix = useRef<{ lat: number; lon: number; t: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    if (!("geolocation" in navigator)) return;

    // Resetting tracking state here (not derived from props) is the point
    // of this effect — it's what "start watching position" means.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDistanceKm(0);
    setPoints([]);
    setStatus("acquiring");
    lastFix.current = null;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus("tracking");
        const { latitude, longitude, accuracy, altitude } = pos.coords;
        const t = pos.timestamp;
        if (accuracy != null && accuracy > MAX_GPS_ACCURACY_M) return;

        const prev = lastFix.current;
        if (!prev) {
          lastFix.current = { lat: latitude, lon: longitude, t };
          setPoints((pts) => [...pts, { lat: latitude, lng: longitude, t, alt: altitude }]);
          return;
        }

        const km = haversineKm(prev.lat, prev.lon, latitude, longitude);
        const meters = km * 1000;
        const seconds = (t - prev.t) / 1000;
        const speedMps = seconds > 0 ? meters / seconds : 0;

        if (meters < MIN_MOVEMENT_M) return; // jitter — keep the old anchor, wait for real movement
        if (speedMps > MAX_PLAUSIBLE_SPEED_MPS) return; // an implausible jump — likely a glitch

        setDistanceKm((d) => d + km);
        setPoints((pts) => [...pts, { lat: latitude, lng: longitude, t, alt: altitude }]);
        lastFix.current = { lat: latitude, lon: longitude, t };
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );

    // Best-effort — a locked/dimmed screen is a common reason background
    // tracking stops getting fixes at all, so keeping it awake helps.
    let wakeLock: { release: () => Promise<void> } | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((lock) => {
        wakeLock = lock;
      })
      .catch(() => {});

    return () => {
      navigator.geolocation.clearWatch(watchId);
      wakeLock?.release().catch(() => {});
    };
  }, [active]);

  return { distanceKm, status, points };
}

function EditableLabel({ workoutId, label }: { workoutId: string; label: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [, startTransition] = useTransition();

  const [prevLabel, setPrevLabel] = useState(label);
  if (label !== prevLabel) {
    setPrevLabel(label);
    setValue(label);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          setEditing(false);
          const trimmed = value.trim();
          if (trimmed && trimmed !== label) startTransition(() => renameWorkout(workoutId, trimmed));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setValue(label);
            setEditing(false);
          }
        }}
        className="w-full border-b border-dashed border-workout bg-transparent font-serif text-xl font-semibold text-ink focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Rename"
      className="text-left font-serif text-xl font-semibold text-ink hover:text-workout"
    >
      {label}
    </button>
  );
}

// A free-text note about the workout — how it felt, what to try next time —
// saved onBlur like EditableLabel above, rather than a separate Save button.
function WorkoutNoteField({ workoutId, note }: { workoutId: string; note: string | null }) {
  const [value, setValue] = useState(note ?? "");
  const [, startTransition] = useTransition();

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value.trim() !== (note ?? "").trim()) startTransition(() => updateWorkoutNote(workoutId, value));
      }}
      placeholder="Add a note — how it felt, what to try next time…"
      rows={2}
      className="mt-3 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-workout focus:outline-none"
    />
  );
}

function dayLabel(dateISO: string): string {
  const today = todayISO();
  if (dateISO === today) return "Today";
  if (dateISO === shiftISO(today, -1)) return "Yesterday";
  return weekdayShortDayMonth(dateISO);
}

function AddExerciseForm({ onCreated }: { onCreated: (ex: Exercise) => void }) {
  const [state, formAction, isPending] = useActionState(createExercise, null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && state?.exercise) {
      onCreated(state.exercise);
      formRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending, state, onCreated]);

  return (
    <div className="mt-2">
      <form ref={formRef} action={formAction} className="flex flex-wrap gap-2">
        <input
          name="name"
          autoFocus
          required
          placeholder="e.g. Cable Fly"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-base focus:border-workout focus:outline-none"
        />
        <select
          name="category"
          defaultValue="Chest"
          className="rounded-lg border border-line bg-card px-2.5 py-2 text-sm focus:border-workout focus:outline-none"
        >
          <option value="Chest">Chest</option>
          <option value="Back">Back</option>
          <option value="Shoulders">Shoulders</option>
          <option value="Biceps">Biceps</option>
          <option value="Triceps">Triceps</option>
          <option value="Forearms">Forearms</option>
          <option value="Quadriceps">Quadriceps</option>
          <option value="Hamstrings">Hamstrings</option>
          <option value="Calves">Calves</option>
          <option value="Glutes">Glutes</option>
          <option value="Abdominals">Abdominals</option>
          <option value="Full Body & Olympic">Full Body & Olympic</option>
          <option value="Other">Other</option>
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-workout px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {state?.error && <p className="mt-1.5 text-xs text-accent">{state.error}</p>}
    </div>
  );
}

// A search-and-tap list rather than a <select> + separate confirm button —
// tapping a result adds it immediately, closer to how Hevy's own exercise
// picker works and much easier to use one-handed on a phone.
function ExercisePicker({
  exercises,
  lastPerformed,
  weightUnit,
  onPick,
  onCreated,
  onCancel,
}: {
  exercises: Exercise[];
  lastPerformed: LastPerformed;
  weightUnit: WeightUnit;
  onPick: (id: string) => void;
  onCreated: (ex: Exercise) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = q ? exercises.filter((ex) => ex.name.toLowerCase().includes(q)) : exercises;
  const byCategory = new Map<string, Exercise[]>();
  for (const ex of filtered) {
    if (!byCategory.has(ex.category)) byCategory.set(ex.category, []);
    byCategory.get(ex.category)!.push(ex);
  }

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2.5 text-base focus:border-workout focus:outline-none"
        />
        <button type="button" onClick={onCancel} className="p-2.5 text-sm text-ink-muted hover:text-accent">
          Cancel
        </button>
      </div>

      <div className="mt-2 max-h-72 overflow-y-auto">
        {byCategory.size === 0 && <p className="px-1 py-3 text-sm text-ink-muted">No matches.</p>}
        {Array.from(byCategory.entries()).map(([category, exs]) => (
          <div key={category}>
            <p className="px-1 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">{category}</p>
            {exs.map((ex) => {
              const last = lastPerformed[ex.id];
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => onPick(ex.id)}
                  className="block w-full rounded-lg px-3 py-3 text-left text-sm text-ink hover:bg-workout-soft active:bg-workout-soft"
                >
                  {ex.name}
                  {last && (
                    <span className="ml-2 text-xs text-ink-muted">
                      Last: {last.sets.map((s) => `${formatWeight(s.weight, weightUnit)}×${s.reps}`).join(", ")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-2 py-1.5 text-xs text-ink-muted underline decoration-line hover:text-workout"
        >
          Can’t find it? Add a new exercise
        </button>
      ) : (
        <AddExerciseForm
          onCreated={(ex) => {
            onCreated(ex);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

// Plain number input flanked by −/+ buttons — quicker to nudge a weight or
// rep count by feel than re-typing it, and much easier to tap accurately
// mid-set than a bare <input type=number>'s tiny native spinner.
function NumberStepper({
  value,
  onChange,
  step,
  min,
  allowAnyValue,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  step: number;
  min: number;
  // The +/- buttons still bump by `step` (e.g. 2.5kg), but some gyms' plates
  // and machines don't land on that increment — this lets someone type any
  // value by hand instead of the native step attribute rejecting it.
  allowAnyValue?: boolean;
  className?: string;
}) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const bump = (delta: number) => {
    const current = parseFloat(value) || 0;
    onChange(String(Math.max(min, round(current + delta))));
  };
  return (
    <div className={`flex items-stretch overflow-hidden rounded-lg border border-line bg-paper ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => bump(-step)}
        className="px-2.5 text-base text-ink-muted hover:bg-workout-soft hover:text-workout active:bg-workout-soft"
        tabIndex={-1}
      >
        −
      </button>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        type="number"
        inputMode="decimal"
        min={min}
        step={allowAnyValue ? "any" : step}
        required
        className="w-14 min-w-0 bg-transparent px-1 py-2 text-center text-base focus:outline-none"
      />
      <button
        type="button"
        onClick={() => bump(step)}
        className="px-2.5 text-base text-ink-muted hover:bg-workout-soft hover:text-workout active:bg-workout-soft"
        tabIndex={-1}
      >
        +
      </button>
    </div>
  );
}

// Reference photo for an exercise — collapsed to a small "how to" toggle by
// default so it doesn't crowd the set-logging UI, opening into the actual
// photo on tap. Silently hides itself if the image fails to load (a
// hotlinked external URL going stale shouldn't leave a broken-image icon
// in the middle of a workout) or if no confident match exists for this
// exercise (see lib/exerciseReference.ts).
function ExerciseReference({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = EXERCISE_REFERENCE_IMAGE[name];
  if (!src || failed) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-workout hover:underline"
      >
        {open ? "Hide how-to" : "How to"}
      </button>
      {open && (
        // eslint-disable-next-line @next/next/no-img-element -- external hotlinked reference photo, not a local asset next/image can optimize
        <img
          src={src}
          alt={`How to perform ${name}`}
          onError={() => setFailed(true)}
          className="mt-2 max-h-56 w-full rounded-lg border border-line object-cover"
        />
      )}
    </div>
  );
}

function ExerciseSection({
  workoutId,
  exercise,
  sets,
  lastPerformed,
  weightUnit,
  onRemove,
  onSetLogged,
}: {
  workoutId: string;
  exercise: Exercise;
  sets: SetRow[];
  lastPerformed?: { dateISO: string; sets: { weight: number; reps: number; isWarmup: boolean }[] };
  weightUnit: WeightUnit;
  onRemove: () => void;
  onSetLogged: () => void;
}) {
  const weightStep = weightUnit === "LB" ? 5 : 2.5;

  // Seed the form from wherever a sensible default comes from: the set just
  // logged this session, or failing that the last time this exercise was
  // worked at all — so re-doing familiar work means tapping "Add set"
  // rather than retyping the same numbers you used last week.
  const seedSet = sets.length > 0 ? sets[sets.length - 1] : lastPerformed?.sets[lastPerformed.sets.length - 1];
  const [weight, setWeight] = useState(() => (seedSet ? String(parseFloat(fromKg(seedSet.weight, weightUnit).toFixed(1))) : ""));
  const [reps, setReps] = useState(() => (seedSet ? String(seedSet.reps) : ""));
  const [isWarmup, setIsWarmup] = useState(false);
  const [isPending, startTransition] = useTransition();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending) onSetLogged();
    wasPending.current = isPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("weight", weight);
    fd.set("reps", reps);
    if (isWarmup) fd.set("isWarmup", "on");
    startTransition(() => {
      addSet(workoutId, exercise.id, fd);
    });
    setIsWarmup(false);
  }

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-ink">{exercise.name}</p>
          {lastPerformed && (
            <p className="mt-0.5 text-xs text-ink-muted">
              Last time ({dayLabel(lastPerformed.dateISO)}):{" "}
              {lastPerformed.sets
                .map((s) => `${formatWeight(s.weight, weightUnit)}×${s.reps}${s.isWarmup ? " (w)" : ""}`)
                .join(", ")}
            </p>
          )}
          <ExerciseReference name={exercise.name} />
        </div>
        {sets.length === 0 && (
          <button type="button" onClick={onRemove} className="rounded-lg px-1.5 py-1 -m-1 text-xs text-ink-muted hover:text-accent">
            Remove
          </button>
        )}
      </div>

      {sets.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {sets.map((set) => (
            <li key={set.id} className="flex items-center gap-2.5 rounded-lg bg-paper px-2.5 py-1.5 text-sm text-ink">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-workout-soft text-xs font-medium text-workout">
                {set.setNumber}
              </span>
              <span className="font-medium tabular-nums">
                {formatWeight(set.weight, weightUnit)} × {set.reps}
              </span>
              {set.isWarmup && <span className="text-xs text-ink-muted">warm-up</span>}
              <form action={removeSet.bind(null, set.id)} className="ml-auto">
                <button type="submit" className="rounded-lg p-2 -m-2 text-ink-muted hover:text-accent">
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2.5">
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Weight ({weightUnit === "LB" ? "lb" : "kg"})</label>
          <NumberStepper value={weight} onChange={setWeight} step={weightStep} min={0} allowAnyValue />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Reps</label>
          <NumberStepper value={reps} onChange={setReps} step={1} min={1} />
        </div>
        <label className="mb-2.5 flex items-center gap-1.5 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={isWarmup}
            onChange={(e) => setIsWarmup(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-line accent-workout"
          />
          Warm-up
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-workout px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Add set
        </button>
      </form>
    </div>
  );
}

export function WorkoutTracker({
  weightUnit,
  distanceUnit,
  exercises,
  openWorkout,
  lastPerformed,
  weekSummary,
  history,
  serverNow,
}: {
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  exercises: Exercise[];
  openWorkout: OpenWorkout;
  lastPerformed: LastPerformed;
  weekSummary: WeekSummary;
  history: HistoryWorkout[];
  serverNow: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [localExercises, setLocalExercises] = useState(exercises);
  const [activeExerciseIds, setActiveExerciseIds] = useState<string[]>(() =>
    openWorkout ? Array.from(new Set(openWorkout.sets.map((s) => s.exerciseId))) : [],
  );
  const [addingExercise, setAddingExercise] = useState(false);
  const [startTab, setStartTab] = useState<WorkoutType | null>(null);
  const [selectedCardioActivity, setSelectedCardioActivity] = useState<string | null>(null);
  const [justFinished, setJustFinished] = useState<JustFinishedWorkout | null>(null);
  const [distanceOverride, setDistanceOverride] = useState<string | null>(null);
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set());
  const [restEndAt, setRestEndAt] = useState<number | null>(null);
  const clockOffsetMs = useClockOffsetMs(serverNow);
  const elapsedSeconds = useElapsedSeconds(openWorkout?.startedAt ?? null, clockOffsetMs);
  const {
    distanceKm: gpsDistanceKm,
    status: gpsStatus,
    points: gpsPoints,
  } = useGpsTrack(!!openWorkout && openWorkout.type === "CARDIO");

  // Reset the exercise picker state whenever the open workout itself
  // changes (a new one starts, or the current one finishes/is discarded) —
  // but not on every set added/removed, which leaves this workout's id
  // unchanged and would otherwise wipe out an exercise section that's been
  // picked but has no sets logged yet. Adjusted during render (rather than
  // in an effect) since it's really just resetting derived state when one
  // particular prop changes.
  const [prevWorkoutId, setPrevWorkoutId] = useState(openWorkout?.id ?? null);
  if ((openWorkout?.id ?? null) !== prevWorkoutId) {
    setPrevWorkoutId(openWorkout?.id ?? null);
    setActiveExerciseIds(openWorkout ? Array.from(new Set(openWorkout.sets.map((s) => s.exerciseId))) : []);
    setAddingExercise(false);
    setDistanceOverride(null);
    setRestEndAt(null);
    // A new workout starting means any previous "just finished" summary is
    // stale — clear it so discarding *this* one doesn't flash the old one
    // back. Finishing sets a fresh snapshot right as it happens, so this
    // never races with that.
    if (openWorkout) {
      setJustFinished(null);
      setStartTab(null);
      setSelectedCardioActivity(null);
    }
  }

  const exerciseById = new Map(localExercises.map((e) => [e.id, e]));

  return (
    <div className="space-y-8">
      {!openWorkout && justFinished && (
        <WorkoutSummary
          workout={justFinished}
          weightUnit={weightUnit}
          distanceUnit={distanceUnit}
          onDone={() => setJustFinished(null)}
        />
      )}

      {!openWorkout && !justFinished && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-ink-muted">Start a workout</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Tapping a type only selects it — it doesn't start anything
                yet. Starting is its own deliberate action below, so a stray
                tap here can't accidentally kick off a timed workout. */}
            <button
              onClick={() => {
                setStartTab("STRENGTH");
                setSelectedCardioActivity(null);
              }}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                startTab === "STRENGTH"
                  ? "border-workout bg-workout-soft text-workout"
                  : "border-line bg-card text-ink-muted hover:border-workout hover:text-workout"
              }`}
            >
              <DumbbellIcon className="h-6 w-6" />
              <span className="text-sm font-medium">Strength</span>
            </button>
            <button
              onClick={() => setStartTab("CARDIO")}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                startTab === "CARDIO"
                  ? "border-workout bg-workout-soft text-workout"
                  : "border-line bg-card text-ink-muted hover:border-workout hover:text-workout"
              }`}
            >
              <ActivityIcon className="h-6 w-6" />
              <span className="text-sm font-medium">Cardio</span>
            </button>
          </div>

          {startTab === "CARDIO" && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-ink-muted">What are you doing?</p>
              <div className="flex flex-wrap gap-2">
                {CARDIO_ACTIVITIES.map((activity) => (
                  <button
                    key={activity}
                    onClick={() => setSelectedCardioActivity(activity)}
                    className={`rounded-lg border px-3.5 py-2 text-sm transition ${
                      selectedCardioActivity === activity
                        ? "border-workout bg-workout-soft text-workout"
                        : "border-line bg-card text-ink hover:border-workout hover:text-workout"
                    }`}
                  >
                    {activity}
                  </button>
                ))}
              </div>
            </div>
          )}

          {startTab && (startTab === "STRENGTH" || selectedCardioActivity) && (
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(() => startWorkout(startTab, startTab === "STRENGTH" ? "Workout" : selectedCardioActivity!))
              }
              className="mt-4 w-full rounded-xl bg-workout py-3.5 text-base font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50 sm:w-auto sm:px-6"
            >
              Start {startTab === "STRENGTH" ? "Workout" : selectedCardioActivity}
            </button>
          )}
        </div>
      )}

      {openWorkout && openWorkout.type === "STRENGTH" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-muted">Strength workout</p>
                <EditableLabel workoutId={openWorkout.id} label={openWorkout.label} />
              </div>
              <p className="font-serif text-3xl font-semibold tabular-nums text-ink">{formatClock(elapsedSeconds)}</p>
            </div>
            <WorkoutNoteField workoutId={openWorkout.id} note={openWorkout.note} />
            <div className="mt-4 flex items-center gap-2">
              <button
                disabled={isPending}
                onClick={() => {
                  const setCount = openWorkout.sets.filter((s) => !s.isWarmup).length;
                  // finishStrengthWorkout deletes the workout server-side
                  // when nothing was logged (see its comment) rather than
                  // saving an empty row — showing a "complete" summary with
                  // share/delete/photo options for a workout that's already
                  // gone would be worse than just skipping the summary here.
                  if (setCount > 0) {
                    setJustFinished({
                      id: openWorkout.id,
                      type: "STRENGTH",
                      label: openWorkout.label,
                      durationSeconds: elapsedSeconds,
                      exerciseCount: activeExerciseIds.length,
                      setCount,
                      volumeKg: computeVolume(openWorkout.sets),
                    });
                  }
                  startTransition(() => finishStrengthWorkout(openWorkout.id));
                }}
                className="rounded-lg bg-ink-solid px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Finish
              </button>
              <button
                disabled={isPending}
                onClick={() => {
                  if (confirm("Discard this workout? It won't be saved anywhere.")) {
                    startTransition(() => deleteWorkout(openWorkout.id));
                  }
                }}
                className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent disabled:opacity-50"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Started by accident? Discard it
              </button>
            </div>
            {restEndAt && (
              <RestTimer
                endAt={restEndAt}
                onExtend={(delta) => setRestEndAt((t) => (t ? t + delta * 1000 : t))}
                onDismiss={() => setRestEndAt(null)}
              />
            )}
          </div>

          {activeExerciseIds.map((exerciseId) => {
            const exercise = exerciseById.get(exerciseId);
            if (!exercise) return null;
            return (
              <ExerciseSection
                key={exerciseId}
                workoutId={openWorkout.id}
                exercise={exercise}
                sets={openWorkout.sets.filter((s) => s.exerciseId === exerciseId)}
                lastPerformed={lastPerformed[exerciseId]}
                weightUnit={weightUnit}
                onRemove={() => setActiveExerciseIds((ids) => ids.filter((id) => id !== exerciseId))}
                onSetLogged={() => setRestEndAt(Date.now() + DEFAULT_REST_SECONDS * 1000)}
              />
            );
          })}

          <div>
            {!addingExercise ? (
              <button
                onClick={() => setAddingExercise(true)}
                className="rounded-xl border border-dashed border-line px-3.5 py-3 text-sm text-ink-muted hover:border-workout hover:text-workout"
              >
                + Add exercise
              </button>
            ) : (
              <ExercisePicker
                exercises={localExercises}
                lastPerformed={lastPerformed}
                weightUnit={weightUnit}
                onCancel={() => setAddingExercise(false)}
                onPick={(id) => {
                  setActiveExerciseIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
                  setAddingExercise(false);
                }}
                onCreated={(ex) => {
                  setLocalExercises((exs) => [...exs, ex]);
                  setActiveExerciseIds((ids) => [...ids, ex.id]);
                  setAddingExercise(false);
                }}
              />
            )}
          </div>
        </div>
      )}

      {openWorkout && openWorkout.type === "CARDIO" && (
        <div className="rounded-2xl border border-line bg-card p-6 shadow-sm text-center">
          <p className="text-sm text-ink-muted">Cardio session</p>
          <div className="flex justify-center">
            <EditableLabel workoutId={openWorkout.id} label={openWorkout.label} />
          </div>
          <p className="mt-3 font-serif text-5xl font-semibold tabular-nums text-ink">{formatClock(elapsedSeconds)}</p>

          <p className="mt-2 text-sm text-ink-muted">
            {gpsStatus === "tracking" &&
              (gpsDistanceKm > 0
                ? `📍 ${formatDistance(gpsDistanceKm, distanceUnit)} tracked so far`
                : "📍 Tracking your distance — get moving for it to pick up a track")}
            {gpsStatus === "acquiring" && "📍 Finding your location…"}
            {gpsStatus === "denied" && "Location unavailable — enter distance yourself below"}
            {gpsStatus === "unsupported" && "Your browser can't track location — enter distance yourself below"}
          </p>

          {gpsPoints.length >= 2 && (
            <div className="mt-3">
              <RouteMap points={gpsPoints} height={260} live />
            </div>
          )}

          <div className="text-left">
            <WorkoutNoteField workoutId={openWorkout.id} note={openWorkout.note} />
          </div>

          <form
            action={finishCardioWorkout.bind(null, openWorkout.id)}
            onSubmit={() => {
              const displayDistance = distanceOverride ?? (gpsDistanceKm > 0 ? fromKm(gpsDistanceKm, distanceUnit).toFixed(2) : "");
              const distanceKm = displayDistance ? toKm(Number(displayDistance), distanceUnit) : undefined;
              setJustFinished({
                id: openWorkout.id,
                type: "CARDIO",
                label: openWorkout.label,
                durationSeconds: elapsedSeconds,
                distanceKm,
                route: gpsPoints,
              });
            }}
            className="mt-5 flex items-center justify-center gap-2"
          >
            <input type="hidden" name="route" value={JSON.stringify(gpsPoints)} />
            <input
              name="distance"
              type="number"
              min="0"
              step="0.01"
              value={distanceOverride ?? (gpsDistanceKm > 0 ? fromKm(gpsDistanceKm, distanceUnit).toFixed(2) : "")}
              onChange={(e) => setDistanceOverride(e.target.value)}
              placeholder={`Distance (${distanceUnit === "MI" ? "mi" : "km"})`}
              className="w-32 rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-workout focus:outline-none"
            />
            <button type="submit" className="rounded-lg bg-ink-solid px-5 py-2 text-sm font-medium text-white hover:opacity-90">
              Finish
            </button>
          </form>
          <p className="mt-1.5 text-xs text-ink-muted">
            {gpsStatus === "tracking" ? "Tracked automatically — edit it above if it’s off." : "Distance is up to you to enter."}
          </p>
          <button
            disabled={isPending}
            onClick={() => {
              if (confirm("Discard this session? It won't be saved anywhere.")) {
                startTransition(() => deleteWorkout(openWorkout.id));
              }
            }}
            className="mx-auto mt-4 flex items-center gap-1 text-xs text-ink-muted hover:text-accent disabled:opacity-50"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Started by accident? Discard it
          </button>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-ink-muted">This week</h2>
        {weekSummary.sessions === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-8 text-center">
            <p className="text-sm text-ink-muted">No workouts logged yet this week.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink-muted">
            {weekSummary.sessions} session{weekSummary.sessions === 1 ? "" : "s"} · {formatMinutes(weekSummary.minutes)}
            {weekSummary.strengthCount > 0 && ` · ${weekSummary.strengthCount} strength`}
            {weekSummary.cardioCount > 0 &&
              ` · ${weekSummary.cardioCount} cardio (${formatDistance(weekSummary.cardioKm, distanceUnit)})`}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Log</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {history.map((w) => (
              <WorkoutLogCard
                key={w.id}
                workout={w}
                weightUnit={weightUnit}
                distanceUnit={distanceUnit}
                expanded={expandedWorkouts.has(w.id)}
                onToggleExpand={() =>
                  setExpandedWorkouts((ids) => {
                    const next = new Set(ids);
                    if (next.has(w.id)) next.delete(w.id);
                    else next.add(w.id);
                    return next;
                  })
                }
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// One editable set row in a past workout's edit view — weight/reps only
// (exercise/warm-up aren't editable after the fact; delete and re-add if
// those are wrong), saved onBlur via updateWorkoutSet.
function EditableSetRow({ set, index, weightUnit }: { set: HistorySet; index: number; weightUnit: WeightUnit }) {
  const [weight, setWeight] = useState(String(parseFloat(fromKg(set.weight, weightUnit).toFixed(1))));
  const [reps, setReps] = useState(String(set.reps));
  const [, startTransition] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("weight", weight);
    fd.set("reps", reps);
    startTransition(() => updateWorkoutSet(set.id, fd));
  }

  return (
    <li className="flex items-center gap-2 text-xs text-ink-muted">
      <span className="w-4 shrink-0">{index + 1}</span>
      <input
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={save}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        className="w-14 rounded border border-line bg-paper px-1.5 py-1 text-center focus:border-workout focus:outline-none"
      />
      <span>{weightUnit === "LB" ? "lb" : "kg"} ×</span>
      <input
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={save}
        type="number"
        inputMode="numeric"
        min={1}
        className="w-12 rounded border border-line bg-paper px-1.5 py-1 text-center focus:border-workout focus:outline-none"
      />
      {set.isWarmup && <span>(warm-up)</span>}
    </li>
  );
}

function WorkoutLogCard({
  workout,
  weightUnit,
  distanceUnit,
  expanded,
  onToggleExpand,
}: {
  workout: HistoryWorkout;
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const isCardio = workout.type === "CARDIO";
  const hasRoute = (workout.route?.length ?? 0) >= 2;
  const pace = isCardio ? formatPace(workout.distanceKm, workout.durationMinutes, distanceUnit) : null;

  // Group sets by exercise, in first-seen order, for the expanded detail
  // view — a proper per-set breakdown like Hevy's own workout log, not
  // just an aggregate count.
  const exerciseOrder: string[] = [];
  const setsByExercise = new Map<string, HistorySet[]>();
  for (const s of workout.sets) {
    if (!setsByExercise.has(s.exerciseName)) {
      setsByExercise.set(s.exerciseName, []);
      exerciseOrder.push(s.exerciseName);
    }
    setsByExercise.get(s.exerciseName)!.push(s);
  }
  const volume = computeVolume(workout.sets);

  return (
    <li className="p-4 text-sm">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            isCardio ? "bg-workout-soft text-workout" : "bg-line text-ink"
          }`}
        >
          {isCardio ? <ActivityIcon className="h-3.5 w-3.5" /> : <DumbbellIcon className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-medium text-ink">{workout.label}</p>
            <p className="shrink-0 text-xs text-ink-muted">{dayLabel(workout.dateISO)}</p>
          </div>
          <p className="mt-0.5 text-ink-muted">
            {isCardio ? (
              <>
                {workout.distanceKm ? `${formatDistance(workout.distanceKm, distanceUnit)} · ` : ""}
                {formatMinutes(workout.durationMinutes ?? 0)}
                {pace ? ` · ${pace}` : ""}
              </>
            ) : (
              <>
                {exerciseOrder.length} exercise{exerciseOrder.length === 1 ? "" : "s"} ·{" "}
                {workout.sets.filter((s) => !s.isWarmup).length} sets · {formatMinutes(workout.durationMinutes ?? 0)}
                {volume > 0 ? ` · ${formatWeight(volume, weightUnit)}` : ""}
              </>
            )}
          </p>

          <div className="mt-1.5 flex items-center gap-3">
            {(!isCardio || hasRoute) && (
              <button
                type="button"
                onClick={onToggleExpand}
                className="flex items-center gap-1 py-1 text-xs font-medium text-workout hover:underline"
              >
                {expanded ? "Hide details" : isCardio ? "View route" : "Show sets"}
                <ChevronDownIcon className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!expanded) onToggleExpand();
                setEditing((v) => !v);
              }}
              className="py-1 text-xs font-medium text-workout hover:underline"
            >
              {editing ? "Done editing" : "Edit"}
            </button>
            <ShareButton
              accentVar="--workout"
              fileName="workout.png"
              shareTitle="My workout"
              shareText={
                isCardio
                  ? `${workout.label}: ${workout.distanceKm ? `${formatDistance(workout.distanceKm, distanceUnit)}, ` : ""}${formatMinutes(workout.durationMinutes ?? 0)} — via Proudly`
                  : `${workout.label}: ${exerciseOrder.length} exercises, ${formatMinutes(workout.durationMinutes ?? 0)} — via Proudly`
              }
              data={{
                eyebrow: isCardio ? "Cardio workout" : "Strength workout",
                heading: workout.label,
                stats: isCardio
                  ? [
                      ...(workout.distanceKm ? [{ label: "Distance", value: formatDistance(workout.distanceKm, distanceUnit) }] : []),
                      { label: "Time", value: formatMinutes(workout.durationMinutes ?? 0) },
                      ...(pace ? [{ label: "Pace", value: pace }] : []),
                    ]
                  : [
                      { label: "Exercises", value: String(exerciseOrder.length) },
                      { label: "Sets", value: String(workout.sets.filter((s) => !s.isWarmup).length) },
                      { label: "Time", value: formatMinutes(workout.durationMinutes ?? 0) },
                    ],
              }}
            />
          </div>

          {editing && (
            <form
              action={updateWorkoutDetails.bind(null, workout.id)}
              className="mt-3 space-y-2.5 border-t border-line pt-3"
            >
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Name</label>
                <input
                  name="label"
                  defaultValue={workout.label}
                  className="w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-workout focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Notes</label>
                <textarea
                  name="note"
                  defaultValue={workout.note ?? ""}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-workout focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2.5">
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Date</label>
                  <input
                    name="date"
                    type="date"
                    defaultValue={workout.dateISO}
                    max={todayISO()}
                    className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-workout focus:outline-none"
                  />
                </div>
                {isCardio && (
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Distance ({distanceUnit === "MI" ? "mi" : "km"})</label>
                    <input
                      name="distance"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={workout.distanceKm ? fromKm(workout.distanceKm, distanceUnit).toFixed(2) : ""}
                      className="w-24 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-workout focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">Minutes</label>
                  <input
                    name="durationMinutes"
                    type="number"
                    min="1"
                    defaultValue={workout.durationMinutes ?? ""}
                    className="w-20 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-workout focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="rounded-lg bg-workout px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Save changes
              </button>

              {!isCardio && exerciseOrder.length > 0 && (
                <div className="space-y-3 border-t border-line pt-3">
                  {exerciseOrder.map((name) => (
                    <div key={name}>
                      <p className="text-sm font-medium text-ink">{name}</p>
                      <ul className="mt-1 space-y-1.5">
                        {setsByExercise.get(name)!.map((s, i) => (
                          <EditableSetRow key={s.id} set={s} index={i} weightUnit={weightUnit} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </form>
          )}

          {expanded && !editing && isCardio && workout.route && (
            <div className="mt-2">
              <RouteMap points={workout.route} />
            </div>
          )}

          {expanded && !editing && !isCardio && (
            <div className="mt-3 space-y-3 border-t border-line pt-3">
              {exerciseOrder.map((name) => (
                <div key={name}>
                  <p className="text-sm font-medium text-ink">{name}</p>
                  <ul className="mt-1 space-y-1">
                    {setsByExercise.get(name)!.map((s, i) => (
                      <li key={s.id} className="flex items-center gap-2 text-xs text-ink-muted">
                        <span className="w-4 shrink-0">{i + 1}</span>
                        <span>
                          {formatWeight(s.weight, weightUnit)} × {s.reps}
                          {s.isWarmup && " (warm-up)"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <form action={deleteWorkout.bind(null, workout.id)}>
          <button type="submit" title="Remove this workout" className="rounded-lg p-2.5 -m-2.5 text-ink-muted hover:text-accent">
            ×
          </button>
        </form>
      </div>
    </li>
  );
}
