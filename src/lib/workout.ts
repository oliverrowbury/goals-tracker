// Total weight moved in a strength workout — sum of weight × reps across
// every working set (warm-ups excluded, same convention Hevy uses so a
// couple of light warm-up sets don't inflate the number).
export function computeVolume(sets: { weight: number; reps: number; isWarmup: boolean }[]): number {
  return sets.filter((s) => !s.isWarmup).reduce((sum, s) => sum + s.weight * s.reps, 0);
}

// "5:12/km" — null when there's nothing to divide by (distance or time missing/zero).
export function formatPace(distanceKm: number | null, durationMinutes: number | null): string | null {
  if (!distanceKm || !durationMinutes || distanceKm <= 0) return null;
  const paceMinutes = durationMinutes / distanceKm;
  const min = Math.floor(paceMinutes);
  const sec = Math.round((paceMinutes - min) * 60);
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

export function formatDistance(km: number): string {
  return `${parseFloat(km.toFixed(2))}km`;
}
