import { shiftISO } from "@/lib/dates";
import { STREAK_FREEZES_PER_WINDOW } from "@/lib/limits";

// Current consecutive-day streak counting back from `fromISO`, given the set
// of ISO dates something happened on. Generic over what "something" is —
// journaling, a finished study session, a finished workout, a completed
// goal — the caller builds the date set, this just walks it backwards.
// A missing entry for `fromISO` itself doesn't break the streak yet (the
// day isn't over) — any earlier missing day does, EXCEPT up to `maxFreezes`
// freebies per trailing 7-day window ("streak freeze"): a missed day
// doesn't reset the count, it just doesn't add to it, so a bad day or two
// a week doesn't undo weeks of real consistency. One more miss than
// `maxFreezes` within that same 7-day window ends the streak as normal.
// Free tier gets one freeze a week (the original, always-on behavior);
// Premium gets two — see STREAK_FREEZES_PER_WINDOW. The window is a plain
// sliding array (max 7 entries) of which of the last 7 real days were
// misses — once it's full, the oldest entry drops off and frees up a new
// freeze.
export function computeStreak(
  activeDates: Set<string>,
  fromISO: string,
  maxFreezes: number = STREAK_FREEZES_PER_WINDOW.FREE,
): number {
  let streak = 0;
  let cursor = fromISO;
  let isFirstDay = true;
  let missesInWindow = 0;
  const window: boolean[] = [];

  while (true) {
    const active = activeDates.has(cursor);
    const isMiss = !active && !isFirstDay;

    if (isMiss) {
      if (missesInWindow >= maxFreezes) break; // out of freezes for the trailing week — streak ends
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
