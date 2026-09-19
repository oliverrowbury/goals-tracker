// Total weight moved in a strength workout — sum of weight × reps across
// every working set (warm-ups excluded, same convention Hevy uses so a
// couple of light warm-up sets don't inflate the number). Always kg — the
// canonical storage unit; convert with kgToDisplayWeight for the UI.
export function computeVolume(sets: { weight: number; reps: number; isWarmup: boolean }[]): number {
  return sets.filter((s) => !s.isWarmup).reduce((sum, s) => sum + s.weight * s.reps, 0);
}

// Epley formula — a common, simple estimate, not a claim of precision (true
// 1RM only comes from actually testing it). 1 rep is already the max, so
// it's returned as-is rather than run through the formula.
export function estimateOneRepMax(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30);
}

// "12:04" under an hour, "1:02:04" once it runs past one — shared between
// the live in-progress timer and the post-workout summary.
export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const KG_PER_LB = 0.45359237;
const KM_PER_MILE = 1.609344;

// Weight and distance are always stored canonically in kg/km — these
// convert to/from whatever the user picked in Settings, at the edges
// (form input in, formatted string out) so the rest of the app never has
// to think about units.
export function toKg(value: number, unit: "KG" | "LB"): number {
  return unit === "LB" ? value * KG_PER_LB : value;
}

export function fromKg(kg: number, unit: "KG" | "LB"): number {
  return unit === "LB" ? kg / KG_PER_LB : kg;
}

export function toKm(value: number, unit: "KM" | "MI"): number {
  return unit === "MI" ? value * KM_PER_MILE : value;
}

export function fromKm(km: number, unit: "KM" | "MI"): number {
  return unit === "MI" ? km / KM_PER_MILE : km;
}

const CM_PER_INCH = 2.54;

// Height follows the same imperial/metric split as distanceUnit (miles vs
// km implies feet/in vs cm) rather than its own separate preference —
// canonical storage is always cm.
export function toCm(value: number, unit: "KM" | "MI"): number {
  return unit === "MI" ? value * CM_PER_INCH : value;
}

export function fromCm(cm: number, unit: "KM" | "MI"): number {
  return unit === "MI" ? cm / CM_PER_INCH : cm;
}

export function formatWeight(kg: number, unit: "KG" | "LB"): string {
  const value = fromKg(kg, unit);
  return `${parseFloat(value.toFixed(1))}${unit === "LB" ? "lb" : "kg"}`;
}

export function formatDistance(km: number, unit: "KM" | "MI" = "KM"): string {
  const value = fromKm(km, unit);
  return `${parseFloat(value.toFixed(2))}${unit === "MI" ? "mi" : "km"}`;
}

// "5:12/km" (or "/mi") — null when there's nothing to divide by (distance
// or time missing/zero).
export function formatPace(distanceKm: number | null, durationMinutes: number | null, unit: "KM" | "MI" = "KM"): string | null {
  if (!distanceKm || !durationMinutes || distanceKm <= 0) return null;
  const distance = fromKm(distanceKm, unit);
  const paceMinutes = durationMinutes / distance;
  const min = Math.floor(paceMinutes);
  const sec = Math.round((paceMinutes - min) * 60);
  return `${min}:${sec.toString().padStart(2, "0")}/${unit === "MI" ? "mi" : "km"}`;
}

export type ExerciseBreakdown = { name: string; sets: { weight: number; reps: number; isWarmup: boolean }[] };

// Groups a workout's flat set list into one entry per exercise, in the
// order each exercise was first logged — shared between the workout log's
// own expanded history view and the social feed/post-detail cards, so a
// friend sees the same set-by-set shape you see in your own history.
export function groupSetsByExercise(
  sets: { exercise: { name: string }; weight: number; reps: number; isWarmup: boolean }[],
): ExerciseBreakdown[] {
  const order: string[] = [];
  const byExercise = new Map<string, ExerciseBreakdown["sets"]>();
  for (const s of sets) {
    if (!byExercise.has(s.exercise.name)) {
      byExercise.set(s.exercise.name, []);
      order.push(s.exercise.name);
    }
    byExercise.get(s.exercise.name)!.push({ weight: s.weight, reps: s.reps, isWarmup: s.isWarmup });
  }
  return order.map((name) => ({ name, sets: byExercise.get(name)! }));
}

// Great-circle distance between two lat/lng points, in km — used to
// accumulate a live distance from GPS fixes during a cardio session (see
// useGpsDistance in WorkoutTracker).
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type RoutePoint = { lat: number; lng: number; t?: number; alt?: number | null };
export type Split = { label: string; durationSeconds: number };

// One entry per completed km (or mile), each the time taken to cover that
// unit — found by walking the tracked points and noting when cumulative
// distance crosses each marker, using each point's own GPS timestamp
// rather than an even split of the total (so a stop for traffic shows up
// as a slow split instead of being smeared across the whole run). Needs
// per-point timestamps, which only cardio sessions tracked live (not
// manually entered ones) have.
export function computeSplits(points: RoutePoint[], unit: "KM" | "MI"): Split[] {
  if (points.length < 2) return [];
  const stepKm = unit === "MI" ? KM_PER_MILE : 1;
  const splits: Split[] = [];
  let cumKm = 0;
  let marker = 1;
  let splitStartT = points[0].t;

  for (let i = 1; i < points.length; i++) {
    cumKm += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    if (cumKm >= stepKm * marker) {
      if (splitStartT != null && points[i].t != null) {
        splits.push({ label: `${unit === "MI" ? "Mile" : "Km"} ${marker}`, durationSeconds: (points[i].t! - splitStartT) / 1000 });
      }
      splitStartT = points[i].t;
      marker++;
    }
  }
  return splits;
}

// Total climbed, in meters — sums only the upward changes between
// consecutive altitude readings, discarding swings under NOISE_FLOOR_M so
// GPS altitude jitter (routinely several meters even standing still)
// doesn't get counted as climbing. Best-effort: phone GPS altitude is
// genuinely inaccurate, this is not survey-grade elevation data. Returns
// null when there's nothing usable (most fixes lack altitude entirely on
// many devices/browsers).
const NOISE_FLOOR_M = 2;
export function computeElevationGainM(points: RoutePoint[]): number | null {
  const alts = points.map((p) => p.alt).filter((a): a is number => a != null);
  if (alts.length < 2) return null;

  let gain = 0;
  let base = alts[0];
  for (let i = 1; i < alts.length; i++) {
    const diff = alts[i] - base;
    if (diff > NOISE_FLOOR_M) {
      gain += diff;
      base = alts[i];
    } else if (diff < -NOISE_FLOOR_M) {
      base = alts[i];
    }
  }
  return Math.round(gain);
}
