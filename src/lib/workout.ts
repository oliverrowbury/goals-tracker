// Total weight moved in a strength workout — sum of weight × reps across
// every working set (warm-ups excluded, same convention Hevy uses so a
// couple of light warm-up sets don't inflate the number). Always kg — the
// canonical storage unit; convert with kgToDisplayWeight for the UI.
export function computeVolume(sets: { weight: number; reps: number; isWarmup: boolean }[]): number {
  return sets.filter((s) => !s.isWarmup).reduce((sum, s) => sum + s.weight * s.reps, 0);
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
