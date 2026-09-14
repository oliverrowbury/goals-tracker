import { shiftISO } from "@/lib/dates";

// Current consecutive-day streak counting back from `fromISO`, given the set
// of ISO dates something happened on. Generic over what "something" is —
// journaling, a finished study session, a finished workout, a completed
// goal — the caller builds the date set, this just walks it backwards.
// A missing entry for `fromISO` itself doesn't break the streak yet (the
// day isn't over) — any earlier missing day does.
export function computeStreak(activeDates: Set<string>, fromISO: string): number {
  let streak = 0;
  let cursor = fromISO;
  let isFirstDay = true;

  while (true) {
    if (activeDates.has(cursor)) {
      streak++;
    } else if (!isFirstDay) {
      break;
    }
    isFirstDay = false;
    cursor = shiftISO(cursor, -1);
  }

  return streak;
}
