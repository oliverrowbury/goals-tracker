import { shiftISO } from "@/lib/dates";

// Current consecutive-day streak counting back from `fromISO`, given the set
// of ISO dates something happened on. Generic over what "something" is —
// journaling, a finished study session, a finished workout, a completed
// goal — the caller builds the date set, this just walks it backwards.
// A missing entry for `fromISO` itself doesn't break the streak yet (the
// day isn't over) — any earlier missing day does, EXCEPT one freebie per
// trailing 7-day window ("streak freeze"): a single missed day doesn't
// reset the count, it just doesn't add to it, so one bad day a week
// doesn't undo weeks of real consistency. A second miss within that same
// 7-day window ends the streak as normal. The window is a plain sliding
// array (max 7 entries) of which of the last 7 real days were misses —
// once it's full, the oldest entry drops off and frees up a new freeze.
export function computeStreak(activeDates: Set<string>, fromISO: string): number {
  let streak = 0;
  let cursor = fromISO;
  let isFirstDay = true;
  let missesInWindow = 0;
  const window: boolean[] = [];

  while (true) {
    const active = activeDates.has(cursor);
    const isMiss = !active && !isFirstDay;

    if (isMiss) {
      if (missesInWindow >= 1) break; // second miss in the trailing week — streak ends
      missesInWindow++;
    }
    if (active) streak++;

    if (!isFirstDay) {
      window.push(isMiss);
      if (window.length > 7 && window.shift()) missesInWindow--;
    }

    isFirstDay = false;
    cursor = shiftISO(cursor, -1);
  }

  return streak;
}
