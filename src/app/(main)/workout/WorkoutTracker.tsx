"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  startWorkout,
  addSet,
  removeSet,
  renameWorkout,
  finishStrengthWorkout,
  finishCardioWorkout,
  deleteWorkout,
  createExercise,
} from "./actions";
import { formatMinutes } from "@/lib/study";
import { formatPace, formatDistance, formatWeight, computeVolume, fromKm, haversineKm } from "@/lib/workout";
import { todayISO, shiftISO } from "@/lib/dates";
import { TrashIcon } from "@/components/Icons";
import { CARDIO_ACTIVITIES, type WorkoutType, type WeightUnit, type DistanceUnit } from "@/lib/constants";
import { RouteMap } from "./RouteMap";

type Exercise = { id: string; name: string; category: string };
type SetRow = { id: string; exerciseId: string; setNumber: number; weight: number; reps: number; isWarmup: boolean };
type OpenWorkout = { id: string; type: WorkoutType; label: string; startedAt: string; sets: SetRow[] } | null;
type LastPerformed = Record<string, { dateISO: string; sets: { weight: number; reps: number; isWarmup: boolean }[] }>;
type WeekSummary = { sessions: number; minutes: number; strengthCount: number; cardioCount: number; cardioKm: number };
type HistorySet = { id: string; exerciseName: string; weight: number; reps: number; isWarmup: boolean };
type RoutePoint = { lat: number; lng: number };
type HistoryWorkout = {
  id: string;
  type: WorkoutType;
  label: string;
  dateISO: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  route: RoutePoint[] | null;
  sets: HistorySet[];
};

function useElapsedSeconds(startedAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
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
  const [status, setStatus] = useState<GpsStatus>("idle");
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const lastFix = useRef<{ lat: number; lon: number; t: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    setDistanceKm(0);
    setPoints([]);
    setStatus("acquiring");
    lastFix.current = null;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus("tracking");
        const { latitude, longitude, accuracy } = pos.coords;
        const t = pos.timestamp;
        if (accuracy != null && accuracy > MAX_GPS_ACCURACY_M) return;

        const prev = lastFix.current;
        if (!prev) {
          lastFix.current = { lat: latitude, lon: longitude, t };
          setPoints((pts) => [...pts, { lat: latitude, lng: longitude }]);
          return;
        }

        const km = haversineKm(prev.lat, prev.lon, latitude, longitude);
        const meters = km * 1000;
        const seconds = (t - prev.t) / 1000;
        const speedMps = seconds > 0 ? meters / seconds : 0;

        if (meters < MIN_MOVEMENT_M) return; // jitter — keep the old anchor, wait for real movement
        if (speedMps > MAX_PLAUSIBLE_SPEED_MPS) return; // an implausible jump — likely a glitch

        setDistanceKm((d) => d + km);
        setPoints((pts) => [...pts, { lat: latitude, lng: longitude }]);
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

  useEffect(() => setValue(label), [label]);

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

function dayLabel(dateISO: string): string {
  const today = todayISO();
  if (dateISO === today) return "Today";
  if (dateISO === shiftISO(today, -1)) return "Yesterday";
  return new Date(`${dateISO}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
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
          <option value="Legs">Legs</option>
          <option value="Glutes">Glutes</option>
          <option value="Core">Core</option>
          <option value="Olympic & Full Body">Olympic & Full Body</option>
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
  onPick,
  onCreated,
  onCancel,
}: {
  exercises: Exercise[];
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
            {exs.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => onPick(ex.id)}
                className="block w-full rounded-lg px-3 py-3 text-left text-sm text-ink hover:bg-workout-soft active:bg-workout-soft"
              >
                {ex.name}
              </button>
            ))}
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

function ExerciseSection({
  workoutId,
  exercise,
  sets,
  lastPerformed,
  weightUnit,
  onRemove,
}: {
  workoutId: string;
  exercise: Exercise;
  sets: SetRow[];
  lastPerformed?: { dateISO: string; sets: { weight: number; reps: number; isWarmup: boolean }[] };
  weightUnit: WeightUnit;
  onRemove: () => void;
}) {
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
        </div>
        {sets.length === 0 && (
          <button type="button" onClick={onRemove} className="text-xs text-ink-muted hover:text-accent">
            Remove
          </button>
        )}
      </div>

      {sets.length > 0 && (
        <ul className="mt-3 space-y-1">
          {sets.map((set) => (
            <li key={set.id} className="flex items-center gap-2 text-sm text-ink">
              <span className="w-5 shrink-0 text-ink-muted">{set.setNumber}</span>
              <span>
                {formatWeight(set.weight, weightUnit)} × {set.reps}
                {set.isWarmup && <span className="ml-1 text-xs text-ink-muted">(warm-up)</span>}
              </span>
              <form action={removeSet.bind(null, set.id)} className="ml-auto">
                <button type="submit" className="rounded-lg p-2 -m-2 text-ink-muted hover:text-accent">
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addSet.bind(null, workoutId, exercise.id)} className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Weight ({weightUnit === "LB" ? "lb" : "kg"})</label>
          <input
            name="weight"
            type="number"
            min="0"
            step="0.5"
            required
            className="w-20 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-workout focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Reps</label>
          <input
            name="reps"
            type="number"
            min="1"
            step="1"
            required
            className="w-16 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-workout focus:outline-none"
          />
        </div>
        <label className="mb-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
          <input type="checkbox" name="isWarmup" className="h-3.5 w-3.5 rounded border-line accent-workout" />
          Warm-up
        </label>
        <button
          type="submit"
          className="rounded-lg bg-workout px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
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
}: {
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  exercises: Exercise[];
  openWorkout: OpenWorkout;
  lastPerformed: LastPerformed;
  weekSummary: WeekSummary;
  history: HistoryWorkout[];
}) {
  const [isPending, startTransition] = useTransition();
  const [localExercises, setLocalExercises] = useState(exercises);
  const [activeExerciseIds, setActiveExerciseIds] = useState<string[]>(() =>
    openWorkout ? Array.from(new Set(openWorkout.sets.map((s) => s.exerciseId))) : [],
  );
  const [addingExercise, setAddingExercise] = useState(false);
  const [startTab, setStartTab] = useState<WorkoutType>("STRENGTH");
  const [distanceOverride, setDistanceOverride] = useState<string | null>(null);
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set());
  const elapsedSeconds = useElapsedSeconds(openWorkout?.startedAt ?? null);
  const {
    distanceKm: gpsDistanceKm,
    status: gpsStatus,
    points: gpsPoints,
  } = useGpsTrack(!!openWorkout && openWorkout.type === "CARDIO");

  // Reset the exercise picker state whenever the open workout itself
  // changes (a new one starts, or the current one finishes/is discarded) —
  // but not on every set added/removed, which leaves this workout's id
  // unchanged and would otherwise wipe out an exercise section that's been
  // picked but has no sets logged yet.
  useEffect(() => {
    setActiveExerciseIds(openWorkout ? Array.from(new Set(openWorkout.sets.map((s) => s.exerciseId))) : []);
    setAddingExercise(false);
    setDistanceOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWorkout?.id]);

  const exerciseById = new Map(localExercises.map((e) => [e.id, e]));

  return (
    <div className="space-y-8">
      {!openWorkout && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Start a workout</h2>
          <div className="inline-flex rounded-xl border border-line bg-card p-1">
            <button
              onClick={() => setStartTab("STRENGTH")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                startTab === "STRENGTH" ? "bg-workout text-white" : "text-ink-muted hover:text-workout"
              }`}
            >
              Strength
            </button>
            <button
              onClick={() => setStartTab("CARDIO")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                startTab === "CARDIO" ? "bg-workout text-white" : "text-ink-muted hover:text-workout"
              }`}
            >
              Cardio
            </button>
          </div>

          {startTab === "STRENGTH" ? (
            <div className="mt-3">
              <button
                disabled={isPending}
                onClick={() => startTransition(() => startWorkout("STRENGTH", "Workout"))}
                className="rounded-xl bg-workout px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                Start Workout
              </button>
              <p className="mt-1.5 text-xs text-ink-muted">You can rename it once it’s started.</p>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {CARDIO_ACTIVITIES.map((activity) => (
                <button
                  key={activity}
                  disabled={isPending}
                  onClick={() => startTransition(() => startWorkout("CARDIO", activity))}
                  className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm text-ink hover:border-workout hover:text-workout disabled:opacity-50"
                >
                  {activity}
                </button>
              ))}
            </div>
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
            <div className="mt-4 flex items-center gap-2">
              <button
                disabled={isPending}
                onClick={() => startTransition(() => finishStrengthWorkout(openWorkout.id))}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
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

          <form
            action={finishCardioWorkout.bind(null, openWorkout.id)}
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
            <button type="submit" className="rounded-lg bg-ink px-5 py-2 text-sm font-medium text-white hover:opacity-90">
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
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isCardio ? "bg-workout" : "bg-ink"}`} />
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

          {(!isCardio || hasRoute) && (
            <button type="button" onClick={onToggleExpand} className="mt-1.5 py-1 text-xs font-medium text-workout hover:underline">
              {expanded ? "Hide details" : isCardio ? "View route" : "Show sets"}
            </button>
          )}

          {expanded && isCardio && workout.route && (
            <div className="mt-2">
              <RouteMap points={workout.route} />
            </div>
          )}

          {expanded && !isCardio && (
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
