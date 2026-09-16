"use client";

import { useRef, useState, useTransition } from "react";
import { DumbbellIcon, ActivityIcon, TrashIcon } from "@/components/Icons";
import {
  formatWeight,
  formatDistance,
  formatPace,
  formatClock,
  computeSplits,
  computeElevationGainM,
  type RoutePoint,
} from "@/lib/workout";
import { ShareButton } from "@/components/ShareButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RouteMap } from "./RouteMap";
import { setWorkoutVisibility, setWorkoutNote, deleteWorkout, uploadWorkoutPhoto, removeWorkoutPhoto } from "./actions";
import { CaptionField } from "@/components/CaptionField";
import type { WorkoutType, WeightUnit, DistanceUnit } from "@/lib/constants";
import type { ActivityVisibility } from "@/generated/prisma/enums";

export type JustFinishedWorkout = {
  id: string;
  type: WorkoutType;
  label: string;
  note: string | null;
  durationSeconds: number;
  exerciseCount?: number;
  setCount?: number;
  volumeKg?: number;
  distanceKm?: number;
  route?: RoutePoint[];
};

function VisibilityPicker({ workoutId }: { workoutId: string }) {
  const [visibility, setVisibility] = useState<ActivityVisibility>("FRIENDS");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-center gap-1.5 rounded-full border border-line bg-paper p-1">
      {(["FRIENDS", "PRIVATE"] as const).map((v) => (
        <button
          key={v}
          type="button"
          disabled={isPending}
          onClick={() => {
            setVisibility(v);
            startTransition(() => setWorkoutVisibility(workoutId, v));
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            visibility === v ? "bg-workout text-white" : "text-ink-muted hover:text-workout"
          }`}
        >
          {v === "FRIENDS" ? "Share with friends" : "Keep to myself"}
        </button>
      ))}
    </div>
  );
}

function PhotoAttach({ workoutId }: { workoutId: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("photo", file);
    startTransition(async () => {
      const result = await uploadWorkoutPhoto(workoutId, formData);
      if (result?.error) setError(result.error);
      else setPhotoUrl(URL.createObjectURL(file));
    });
  }

  if (photoUrl) {
    return (
      <div className="relative mt-5 inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="" className="max-h-72 rounded-2xl border border-line object-cover" />
        <button
          type="button"
          title="Remove photo"
          disabled={isPending}
          onClick={() => {
            setPhotoUrl(null);
            startTransition(() => removeWorkoutPhoto(workoutId));
          }}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white hover:bg-ink"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-dashed border-line px-4 py-2.5 text-sm text-ink-muted hover:border-workout hover:text-workout disabled:opacity-50"
      >
        {isPending ? "Uploading…" : "+ Add a photo"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// A dedicated "just finished" screen — Strava's post-run recap (big hero
// number, route map, pace, splits) crossed with Hevy's post-lift one
// (exercise/set/volume breakdown) — rather than dropping straight back to
// the plain "start a workout" screen the instant Finish is tapped. Also
// where the Strava-style "who sees this" choice, a photo, and delete all
// live, since this is the one moment a workout is guaranteed to be on
// screen right after being created.
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
  const splits = isCardio && workout.route ? computeSplits(workout.route, distanceUnit) : [];
  const elevationGainM = isCardio && workout.route ? computeElevationGainM(workout.route) : null;

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

      <div className={`mt-5 grid gap-3 border-t border-line pt-5 text-sm ${isCardio && elevationGainM != null ? "grid-cols-4" : "grid-cols-3"}`}>
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
            {elevationGainM != null && (
              <div>
                <p className="font-serif text-xl font-semibold text-ink">{elevationGainM}m</p>
                <p className="text-xs text-ink-muted">Elevation</p>
              </div>
            )}
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

      {splits.length > 0 && (
        <div className="mt-5 border-t border-line pt-5 text-left">
          <p className="mb-2 text-xs font-medium text-ink-muted">Splits</p>
          <ul className="space-y-1">
            {splits.map((s) => (
              <li key={s.label} className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{s.label}</span>
                <span className="font-medium tabular-nums text-ink">{formatClock(Math.round(s.durationSeconds))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PhotoAttach workoutId={workout.id} />

      <div className="mt-5 border-t border-line pt-5 text-left">
        <CaptionField
          initialValue={workout.note ?? ""}
          onSave={(value) => setWorkoutNote(workout.id, value)}
          focusClassName="focus:border-workout"
        />
      </div>

      <div className="mt-4">
        <VisibilityPicker workoutId={workout.id} />
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
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

      <ConfirmButton
        triggerClassName="mx-auto mt-4 flex items-center gap-1 text-xs text-ink-muted hover:text-accent disabled:opacity-50"
        title="Delete this workout?"
        message="This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          deleteWorkout(workout.id);
          onDone();
        }}
      >
        <TrashIcon className="h-3.5 w-3.5" />
        Delete this workout
      </ConfirmButton>
    </div>
  );
}
