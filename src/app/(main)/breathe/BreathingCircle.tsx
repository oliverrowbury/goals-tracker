"use client";

import { useEffect, useState } from "react";

// Box breathing: 4s in, 4s hold, 4s out, 4s hold — a well-known, simple
// pattern that doesn't need any explanation for a first-time user.
const PHASES = [
  { label: "Breathe in", seconds: 4, scale: 1.4 },
  { label: "Hold", seconds: 4, scale: 1.4 },
  { label: "Breathe out", seconds: 4, scale: 1 },
  { label: "Hold", seconds: 4, scale: 1 },
] as const;

export function BreathingCircle() {
  const [running, setRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(PHASES[0].seconds);

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        setPhaseIndex((p) => (p + 1) % PHASES.length);
        return PHASES[(phaseIndex + 1) % PHASES.length].seconds;
      });
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phaseIndex]);

  const phase = PHASES[phaseIndex];

  return (
    <div className="flex flex-col items-center gap-8 py-10">
      <div className="relative flex h-64 w-64 items-center justify-center">
        <div
          className="absolute h-56 w-56 rounded-full opacity-30 transition-transform ease-linear"
          style={{
            background: "conic-gradient(from 0deg, var(--accent), var(--goals), var(--study), var(--calm), var(--accent))",
            transform: running ? "rotate(360deg)" : "rotate(0deg)",
            transitionDuration: running ? "16s" : "0s",
            filter: "blur(10px)",
          }}
        />
        <div
          className="absolute h-32 w-32 rounded-full bg-calm-soft transition-transform ease-in-out"
          style={{
            transform: `scale(${running ? phase.scale : 1})`,
            transitionDuration: `${phase.seconds}s`,
          }}
        />
        <div className="relative flex h-32 w-32 flex-col items-center justify-center rounded-full border-2 border-calm bg-card text-center">
          <span className="font-serif text-lg font-medium text-ink">{running ? phase.label : "Ready?"}</span>
          {running && <span className="text-sm text-ink-muted">{secondsLeft}</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (running) {
            setRunning(false);
          } else {
            setPhaseIndex(0);
            setSecondsLeft(PHASES[0].seconds);
            setRunning(true);
          }
        }}
        className="rounded-lg bg-calm px-5 py-2.5 text-sm font-medium text-white hover:bg-calm-strong"
      >
        {running ? "Stop" : "Start breathing"}
      </button>
    </div>
  );
}
