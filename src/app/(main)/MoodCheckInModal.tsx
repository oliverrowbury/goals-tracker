"use client";

import { useState, useTransition } from "react";
import { setMood } from "./journal/actions";
import { MOODS } from "@/lib/mood";

// Shown once per day, right after login, until answered — no skip button
// on purpose. Gated by the server (only rendered when today's mood is
// still unset), so once answered it's simply gone for the rest of the day.
export function MoodCheckInModal({ dateISO }: { dateISO: string }) {
  const [answered, setAnswered] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (answered) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-7 text-center shadow-lg">
        <p className="font-serif text-xl font-semibold text-ink">How are you feeling today?</p>
        <p className="mt-1 text-sm text-ink-muted">Pick one to get started.</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              title={m.label}
              disabled={isPending}
              onClick={() => {
                setAnswered(true); // optimistic — closes immediately
                startTransition(() => {
                  setMood(dateISO, m.value);
                });
              }}
              className="rounded-full p-2 text-3xl transition-transform hover:scale-110 hover:bg-calm-soft disabled:opacity-50"
            >
              {m.face}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
