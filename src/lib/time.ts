import { useEffect, useRef, useState } from "react";

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

// Animates from 0 up to `target` over `durationMs`, easing out — the
// post-workout/study summary screens' hero number counting up rather than
// just appearing, Strava/Hevy-style. Restarts whenever `target` itself
// changes (not on every render), which only happens here when a freshly
// finished workout/session's numbers are known for the first time.
export function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    }
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- durationMs is a constant per call site, not meant to retrigger the animation
  }, [target]);

  return value;
}
