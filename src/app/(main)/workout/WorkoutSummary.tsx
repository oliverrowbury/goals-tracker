"use client";

import { DumbbellIcon, ActivityIcon } from "@/components/Icons";
import { formatWeight, formatDistance, formatPace, formatClock } from "@/lib/workout";
import { ShareButton } from "@/components/ShareButton";
import { RouteMap } from "./RouteMap";
import type { WorkoutType, WeightUnit, DistanceUnit } from "@/lib/constants";

export type JustFinishedWorkout = {
  type: WorkoutType;
  label: string;
  durationSeconds: number;
  exerciseCount?: number;
  setCount?: number;
  volumeKg?: number;
  distanceKm?: number;
  route?: { lat: number; lng: number }[];
};

// A dedicated "just finished" screen — Strava's post-run recap (big hero
// number, route map, pace) crossed with Hevy's post-lift one (exercise/set/
// volume breakdown) — rather than dropping straight back to the plain
// "start a workout" screen the instant Finish is tapped.
export function WorkoutSummary({
  workout,
  weightUnit,
  distanceUnit,
  onDone,
}: {
  workout: JustFinishedWorkout;
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  onDone: () => void;
}) {
  const isCardio = workout.type === "CARDIO";
  const pace = isCardio ? formatPace(workout.distanceKm ?? null, workout.durationSeconds / 60, distanceUnit) : null;

  return (
    <div className="rounded-2xl border border-line bg-card p-6 text-center shadow-sm sm:p-8">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-workout-soft text-workout">
        {isCardio ? <ActivityIcon className="h-6 w-6" /> : <DumbbellIcon className="h-6 w-6" />}
      </span>
      <p className="mt-3 text-sm font-medium text-ink-muted">Workout complete</p>
      <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">{workout.label}</h2>

      {/* Hero number — distance for cardio (Strava's headline stat), time
          for strength (Hevy's), since that's what each type is really
          measured by. */}
      <p className="mt-4 font-serif text-5xl font-semibold tabular-nums text-ink">
        {isCardio && workout.distanceKm ? formatDistance(workout.distanceKm, distanceUnit) : formatClock(workout.durationSeconds)}
      </p>

      {isCardio && workout.route && workout.route.length >= 2 && (
        <div className="mt-5">
          <RouteMap points={workout.route} height={220} />
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-5 text-sm">
        {isCardio ? (
          <>
            <div>
              <p className="font-serif text-xl font-semibold text-ink">{formatClock(workout.durationSeconds)}</p>
              <p className="text-xs text-ink-muted">Time</p>
            </div>
            <div>
              <p className="font-serif text-xl font-semibold text-ink">{pace ?? "—"}</p>
              <p className="text-xs text-ink-muted">Pace</p>
            </div>
            <div>
              <p className="font-serif text-xl font-semibold text-ink">
                {workout.distanceKm ? formatDistance(workout.distanceKm, distanceUnit) : "—"}
              </p>
              <p className="text-xs text-ink-muted">Distance</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="font-serif text-xl font-semibold text-ink">{workout.exerciseCount ?? 0}</p>
              <p className="text-xs text-ink-muted">Exercises</p>
            </div>
            <div>
              <p className="font-serif text-xl font-semibold text-ink">{workout.setCount ?? 0}</p>
              <p className="text-xs text-ink-muted">Sets</p>
            </div>
            <div>
              <p className="font-serif text-xl font-semibold text-ink">{formatWeight(workout.volumeKg ?? 0, weightUnit)}</p>
              <p className="text-xs text-ink-muted">Volume</p>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <ShareButton
          accentVar="--workout"
          fileName="workout.png"
          shareTitle="My workout"
          shareText={
            isCardio
              ? `${workout.label}: ${workout.distanceKm ? `${formatDistance(workout.distanceKm, distanceUnit)}, ` : ""}${formatClock(workout.durationSeconds)} — via Proudly`
              : `${workout.label}: ${workout.exerciseCount ?? 0} exercises, ${formatClock(workout.durationSeconds)} — via Proudly`
          }
          data={{
            eyebrow: isCardio ? "Cardio workout" : "Strength workout",
            heading: workout.label,
            stats: isCardio
              ? [
                  ...(workout.distanceKm ? [{ label: "Distance", value: formatDistance(workout.distanceKm, distanceUnit) }] : []),
                  { label: "Time", value: formatClock(workout.durationSeconds) },
                  ...(pace ? [{ label: "Pace", value: pace }] : []),
                ]
              : [
                  { label: "Exercises", value: String(workout.exerciseCount ?? 0) },
                  { label: "Sets", value: String(workout.setCount ?? 0) },
                  { label: "Time", value: formatClock(workout.durationSeconds) },
                ],
          }}
          className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted hover:border-workout hover:text-workout"
        />
        <button type="button" onClick={onDone} className="rounded-lg bg-ink-solid px-5 py-2 text-sm font-medium text-white hover:opacity-90">
          Done
        </button>
      </div>
    </div>
  );
}
