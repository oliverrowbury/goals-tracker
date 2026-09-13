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

// A single bad GPS fix shouldn't wreck the total, so fixes are filtered
// two ways before being added: too-imprecise (a poor accuracy radius,
// common indoors or under tree cover) and too-fast (an instant "jump"
// between two fixes implying a speed nothing on foot or a bike hits —
// almost always a GPS glitch rather than real movement).
const MAX_GPS_ACCURACY_M = 30;
const MAX_PLAUSIBLE_SPEED_MPS = 12; // ~43km/h — generous enough for a hard bike leg

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
        const seconds = (t - prev.t) / 1000;
        const speedMps = seconds > 0 ? (km * 1000) / seconds : 0;
        if (speedMps <= MAX_PLAUSIBLE_SPEED_MPS) {
          setDistanceKm((d) => d + km);
          setPoints((pts) => [...pts, { lat: latitude, lng: longitude }]);
          lastFix.current = { lat: latitude, lon: longitude, t };
        }
        // else: drop this one fix as a likely glitch, but keep the old
        // anchor point so tracking recovers on the next good fix.
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
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
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm focus:border-workout focus:outline-none"
        />
        <select
          name="category"
          defaultValue="Chest"
          className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm focus:border-workout focus:outline-none"
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
          className="rounded-lg bg-workout px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {state?.error && <p className="mt-1.5 text-xs text-accent">{state.error}</p>}
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
                <button type="submit" className="text-ink-muted hover:text-accent">
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
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [pickedExerciseId, setPickedExerciseId] = useState("");
  const [startTab, setStartTab] = useState<WorkoutType>("STRENGTH");
  const [distanceOverride, setDistanceOverride] = useState<string | null>(null);
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
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
    setCreatingExercise(false);
    setPickedExerciseId("");
    setDistanceOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWorkout?.id]);

  const exerciseById = new Map(localExercises.map((e) => [e.id, e]));
  const byCategory = new Map<string, Exercise[]>();
  for (const ex of localExercises) {
    if (!byCategory.has(ex.category)) byCategory.set(ex.category, []);
    byCategory.get(ex.category)!.push(ex);
  }

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
              <p className="font-serif text-3xl font-semibold tabular-nums text-workout">{formatClock(elapsedSeconds)}</p>
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
                className="rounded-xl border border-dashed border-line px-3.5 py-2.5 text-sm text-ink-muted hover:border-workout hover:text-workout"
              >
                + Add exercise
              </button>
            ) : (
              <div className="rounded-xl border border-line bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={pickedExerciseId}
                    onChange={(e) => setPickedExerciseId(e.target.value)}
                    className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-workout focus:outline-none"
                  >
                    <option value="">Choose an exercise…</option>
                    {Array.from(byCategory.entries()).map(([category, exs]) => (
                      <optgroup key={category} label={category}>
                        {exs.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!pickedExerciseId}
                    onClick={() => {
                      setActiveExerciseIds((ids) => (ids.includes(pickedExerciseId) ? ids : [...ids, pickedExerciseId]));
                      setPickedExerciseId("");
                      setAddingExercise(false);
                    }}
                    className="rounded-lg bg-workout px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingExercise(false);
                      setCreatingExercise(false);
                    }}
                    className="text-sm text-ink-muted hover:text-accent"
                  >
                    Cancel
                  </button>
                </div>
                {!creatingExercise ? (
                  <button
                    type="button"
                    onClick={() => setCreatingExercise(true)}
                    className="mt-2 text-xs text-ink-muted underline decoration-line hover:text-workout"
                  >
                    Can’t find it? Add a new exercise
                  </button>
                ) : (
                  <AddExerciseForm
                    onCreated={(ex) => {
                      setLocalExercises((exs) => [...exs, ex]);
                      setActiveExerciseIds((ids) => [...ids, ex.id]);
                      setAddingExercise(false);
                      setCreatingExercise(false);
                    }}
                  />
                )}
              </div>
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
          <p className="mt-3 font-serif text-5xl font-semibold tabular-nums text-workout">{formatClock(elapsedSeconds)}</p>

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
              <RouteMap points={gpsPoints} height={180} />
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
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Recent workouts</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {history.map((w) => {
              if (w.type === "CARDIO") {
                const pace = formatPace(w.distanceKm, w.durationMinutes, distanceUnit);
                const hasRoute = (w.route?.length ?? 0) >= 2;
                const expanded = expandedRoutes.has(w.id);
                return (
                  <li key={w.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-workout" />
                      <span className="text-ink">{w.label}</span>
                      <span className="text-ink-muted">
                        — {w.distanceKm ? `${formatDistance(w.distanceKm, distanceUnit)} · ` : ""}
                        {formatMinutes(w.durationMinutes ?? 0)}
                        {pace ? ` · ${pace}` : ""}
                      </span>
                      <span className="text-xs text-ink-muted">{dayLabel(w.dateISO)}</span>
                      {hasRoute && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRoutes((ids) => {
                              const next = new Set(ids);
                              if (next.has(w.id)) next.delete(w.id);
                              else next.add(w.id);
                              return next;
                            })
                          }
                          className="ml-auto text-xs text-workout hover:underline"
                        >
                          {expanded ? "Hide route" : "View route"}
                        </button>
                      )}
                      <form action={deleteWorkout.bind(null, w.id)} className={hasRoute ? "" : "ml-auto"}>
                        <button type="submit" title="Remove this workout" className="text-ink-muted hover:text-accent">
                          ×
                        </button>
                      </form>
                    </div>
                    {expanded && w.route && (
                      <div className="mt-2">
                        <RouteMap points={w.route} />
                      </div>
                    )}
                  </li>
                );
              }

              const exerciseCount = new Set(w.sets.map((s) => s.exerciseName)).size;
              const setCount = w.sets.filter((s) => !s.isWarmup).length;
              const volume = computeVolume(w.sets);

              return (
                <li key={w.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-workout" />
                    <span className="text-ink">{w.label}</span>
                    <span className="text-ink-muted">
                      — {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"} · {setCount} set
                      {setCount === 1 ? "" : "s"} · {formatMinutes(w.durationMinutes ?? 0)}
                    </span>
                    <span className="text-xs text-ink-muted">{dayLabel(w.dateISO)}</span>
                    <form action={deleteWorkout.bind(null, w.id)} className="ml-auto">
                      <button type="submit" title="Remove this workout" className="text-ink-muted hover:text-accent">
                        ×
                      </button>
                    </form>
                  </div>
                  {volume > 0 && (
                    <p className="ml-4 mt-1 text-xs text-ink-muted">{formatWeight(volume, weightUnit)} total volume</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
