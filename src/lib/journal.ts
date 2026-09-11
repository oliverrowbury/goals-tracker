import { shiftISO } from "@/lib/dates";

// Current consecutive-day journaling streak, counting back from `fromISO`.
// A missing entry for `fromISO` itself doesn't break the streak yet (the
// day isn't over) — any earlier missing day does.
export function computeJournalStreak(journaledDates: Set<string>, fromISO: string): number {
  let streak = 0;
  let cursor = fromISO;
  let isFirstDay = true;

  while (true) {
    if (journaledDates.has(cursor)) {
      streak++;
    } else if (!isFirstDay) {
      break;
    }
    isFirstDay = false;
    cursor = shiftISO(cursor, -1);
  }

  return streak;
}
