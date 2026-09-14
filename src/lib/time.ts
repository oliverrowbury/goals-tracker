import { useState } from "react";

// How far ahead the client's own clock is versus the server's, captured
// once per page load. A live timer (study session, workout) computes
// elapsed time as `Date.now() - startedAt`, which is silently wrong if the
// two clocks disagree — a desktop whose system clock has drifted (unlike a
// phone, which usually syncs itself over the cellular network) can end up
// with a small negative "elapsed" that gets clamped to 0 and never moves,
// which just looks like the timer never started. Subtracting this offset
// from every `Date.now()` read corrects for that without needing to poll
// the server.
export function useClockOffsetMs(serverNowISO: string): number {
  const [offsetMs] = useState(() => Date.now() - Date.parse(serverNowISO));
  return offsetMs;
}
