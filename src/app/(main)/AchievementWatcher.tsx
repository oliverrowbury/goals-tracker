"use client";

import { useEffect, useState } from "react";
import { BADGE_INFO } from "@/lib/badgeInfo";
import type { Badge } from "@/generated/prisma/enums";

type EarnedBadge = { badge: Badge; earnedAtMs: number };
type ToastItem = { kind: "badge"; badge: Badge } | { kind: "level"; level: number };

const SEEN_BADGES_KEY = "seenBadges";
const SEEN_LEVEL_KEY = "seenLevel";
// Only celebrate a badge earned in roughly the last page load's worth of
// time — anything older is either already-seen (normal case) or, on a
// fresh device/cleared storage, ancient history that shouldn't replay as a
// flood of toasts. 5 minutes comfortably covers "just earned it, navigated
// to another page before this rendered."
const RECENT_MS = 5 * 60_000;

function readSeenBadges(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_BADGES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeenBadges(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(Array.from(seen)));
  } catch {
    // not persisted this session — not worth surfacing to the user
  }
}

function readSeenLevel(): number | null {
  try {
    const raw = localStorage.getItem(SEEN_LEVEL_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writeSeenLevel(level: number) {
  try {
    localStorage.setItem(SEEN_LEVEL_KEY, String(level));
  } catch {
    // not persisted this session — not worth surfacing to the user
  }
}

// Mounted once in the (main) layout so it sees every badge/level the user
// has, on every page — new ones are detected by diffing against a
// locally-remembered "seen" state rather than any push mechanism, since
// finishing a workout/study session/goal already does a full server
// round-trip and router refresh, which re-renders the layout with fresh
// data. Badges and level-ups share one toast queue (was badge-only,
// renamed) since they're the same kind of "you just achieved something"
// moment and shouldn't stack as separate UI.
export function AchievementWatcher({ badges, level }: { badges: EarnedBadge[]; level: number }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);

  useEffect(() => {
    const seen = readSeenBadges();
    const now = Date.now();
    const fresh: ToastItem[] = [];
    let changed = false;

    for (const b of badges) {
      const key = b.badge;
      if (seen.has(key)) continue;
      seen.add(key);
      changed = true;
      if (now - b.earnedAtMs < RECENT_MS) fresh.push({ kind: "badge", badge: b.badge });
    }

    if (changed) writeSeenBadges(seen);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the badges prop changing (a new one earned server-side), not a per-render update
    if (fresh.length > 0) setQueue((q) => [...q, ...fresh]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badges.map((b) => b.badge).join(",")]);

  useEffect(() => {
    const seenLevel = readSeenLevel();
    // No stored level yet (first load on this device, or storage was
    // cleared) — baseline silently rather than celebrating whatever level
    // the account already happens to be at. Only a level gained *since*
    // last seen counts, same "don't replay ancient history" reasoning as
    // badges' RECENT_MS window above.
    if (seenLevel !== null && level > seenLevel) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the level prop changing (XP awarded server-side), not a per-render update, same reasoning as the badges effect above
      setQueue((q) => [...q, { kind: "level", level }]);
    }
    writeSeenLevel(level);
  }, [level]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 4200);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;

  const { emoji, label, description } =
    current.kind === "level"
      ? { emoji: "⭐", label: `Level ${current.level}`, description: "Keep it going." }
      : { emoji: BADGE_INFO[current.badge].emoji, label: BADGE_INFO[current.badge].label, description: BADGE_INFO[current.badge].description };

  return (
    <div
      role="status"
      className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-[badge-in_0.3s_ease-out] rounded-2xl border border-line bg-card px-4 py-3 shadow-lg"
    >
      <button
        type="button"
        onClick={() => setQueue((q) => q.slice(1))}
        className="absolute right-2 top-2 p-1.5 text-ink-muted hover:text-accent"
        aria-label="Dismiss"
      >
        ×
      </button>
      <div className="flex items-center gap-3 pr-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xl">{emoji}</span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent">{current.kind === "level" ? "Level up" : "Badge earned"}</p>
          <p className="font-serif text-base font-semibold text-ink">{label}</p>
          <p className="text-xs text-ink-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}
