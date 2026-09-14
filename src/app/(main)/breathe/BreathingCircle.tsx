"use client";

import { useEffect, useState } from "react";

// Box breathing: 4s in, 4s hold, 4s out, 4s hold — a well-known, simple
// pattern that doesn't need any explanation for a first-time user.
const PHASES = [
  { label: "Breathe in", seconds: 4, scale: 1.35 },
  { label: "Hold", seconds: 4, scale: 1.35 },
  { label: "Breathe out", seconds: 4, scale: 1 },
  { label: "Hold", seconds: 4, scale: 1 },
] as const;

const RADIUS = 118;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// An organic ease — slow to start and end, quick through the middle —
// rather than the mechanical, evenly-paced feel of a linear or default
// ease-in-out curve. This is what makes the orb read as "breathing"
// rather than just resizing.
const BREATH_EASE = "cubic-bezier(0.45, 0, 0.4, 1)";

export function BreathingCircle() {
  const [running, setRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(PHASES[0].seconds);
  const [rounds, setRounds] = useState(0);
  const [ringOffset, setRingOffset] = useState(CIRCUMFERENCE);

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        setPhaseIndex((p) => {
          const next = (p + 1) % PHASES.length;
          if (next === 0) setRounds((r) => r + 1);
          return next;
        });
        return PHASES[(phaseIndex + 1) % PHASES.length].seconds;
      });
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phaseIndex]);

  // The ring drains over each phase — snap it back to full instantly (no
  // transition), then on the next frame kick off the drain-to-empty
  // transition over that phase's duration. Doing it in one step wouldn't
  // animate at all, since the browser has nothing to transition *from* yet.
  useEffect(() => {
    if (!running) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: resets the transition's starting point before animating it, see comment above
    setRingOffset(0);
    const raf = requestAnimationFrame(() => setRingOffset(CIRCUMFERENCE));
    return () => cancelAnimationFrame(raf);
  }, [running, phaseIndex]);

  const phase = PHASES[phaseIndex];

  function toggle() {
    if (running) {
      setRunning(false);
      setRingOffset(CIRCUMFERENCE);
    } else {
      setPhaseIndex(0);
      setSecondsLeft(PHASES[0].seconds);
      setRounds(0);
      setRunning(true);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-10">
      <button
        type="button"
        onClick={toggle}
        className="relative flex h-80 w-80 items-center justify-center rounded-full"
        aria-label={running ? "Stop breathing exercise" : "Start breathing exercise"}
      >
        {/* Ambient halo — rotates continuously, independent of the breathing
            phase, so there's always some motion even through a still "hold". */}
        <div
          className="absolute inset-0 rounded-full opacity-40 [animation:slow-spin_18s_linear_infinite]"
          style={{ background: "conic-gradient(from 0deg, var(--calm-soft), transparent 30%, var(--calm-soft) 60%, transparent 90%)" }}
        />

        {/* Three softly offset layers scaling together give the orb depth,
            rather than one flat circle resizing. */}
        <div
          className="absolute inset-6 rounded-full opacity-50 blur-2xl transition-transform"
          style={{
            transform: `scale(${running ? phase.scale * 1.08 : 1.08})`,
            transitionDuration: `${phase.seconds}s`,
            transitionTimingFunction: BREATH_EASE,
            background: "radial-gradient(circle, var(--calm), transparent 72%)",
          }}
        />
        <div
          className="absolute inset-10 rounded-full opacity-70 blur-lg transition-transform"
          style={{
            transform: `scale(${running ? phase.scale * 0.95 : 0.95})`,
            transitionDuration: `${phase.seconds}s`,
            transitionTimingFunction: BREATH_EASE,
            background: "radial-gradient(circle, var(--calm), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-14 rounded-full bg-calm-soft transition-transform"
          style={{
            transform: `scale(${running ? phase.scale : 1})`,
            transitionDuration: `${phase.seconds}s`,
            transitionTimingFunction: BREATH_EASE,
          }}
        />

        <svg viewBox="0 0 256 256" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="128" cy="128" r={RADIUS} fill="none" stroke="var(--line)" strokeWidth="3" />
          <circle
            cx="128"
            cy="128"
            r={RADIUS}
            fill="none"
            stroke="var(--calm)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={running ? ringOffset : 0}
            style={{ transition: running ? `stroke-dashoffset ${phase.seconds}s linear` : "none" }}
          />
        </svg>

        <div className="relative flex h-32 w-32 flex-col items-center justify-center rounded-full border-2 border-calm bg-card text-center shadow-sm">
          <span key={running ? phaseIndex : "idle"} className="[animation:fade-in_0.5s_ease]">
            <span className="block font-serif text-lg font-medium text-ink">{running ? phase.label : "Tap to start"}</span>
          </span>
          {running && (
            <span key={secondsLeft} className="mt-0.5 block text-sm text-ink-muted [animation:fade-in_0.3s_ease]">
              {secondsLeft}
            </span>
          )}
        </div>
      </button>

      {running && rounds > 0 && (
        <p className="text-sm text-ink-muted [animation:fade-in_0.4s_ease]">
          {rounds} round{rounds === 1 ? "" : "s"} done
        </p>
      )}

      <button
        type="button"
        onClick={toggle}
        className="rounded-lg bg-calm px-5 py-2.5 text-sm font-medium text-white hover:bg-calm-strong"
      >
        {running ? "Stop" : "Start breathing"}
      </button>
    </div>
  );
}
