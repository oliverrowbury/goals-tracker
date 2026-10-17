"use client";

// A small celebratory burst over the achievement toast — Premium-only (see
// AchievementWatcher), free users keep the existing plain toast. Pure CSS
// (confetti-fall in globals.css), no canvas/animation library — a dozen
// divs is plenty for a flourish that's on screen for under a second.
const COLORS = ["#0e7d74", "#4f7ba6", "#5f9e6f", "#b8474a", "#b8790f", "#8570b3"];
const PIECE_COUNT = 14;

// Stable per-mount randomization — generated once at module scope isn't
// right either (every toast would replay the exact same burst), so this
// runs fresh each time Confetti mounts, which is exactly once per toast
// (key={current.kind + ...} on the parent remounts it for every new item).
function makePieces() {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    id: i,
    left: 10 + Math.random() * 80,
    delayMs: Math.random() * 150,
    x: `${(Math.random() - 0.5) * 80}px`,
    r: `${(Math.random() - 0.5) * 540}deg`,
    color: COLORS[i % COLORS.length],
  }));
}

export function Confetti() {
  const pieces = makePieces();
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-1 h-0 overflow-visible" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: 0,
            width: 6,
            height: 6,
            borderRadius: 1,
            backgroundColor: p.color,
            animation: `confetti-fall 900ms ease-in ${p.delayMs}ms both`,
            ["--x" as string]: p.x,
            ["--r" as string]: p.r,
          }}
        />
      ))}
    </div>
  );
}
