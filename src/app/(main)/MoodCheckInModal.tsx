"use client";

import { useState, useTransition } from "react";
import { setMood } from "./journal/actions";
import { MOODS } from "@/lib/mood";

// Shown once per day, right after login, until answered — no skip button
// on purpose. Gated by the server (only rendered when today's mood is
// still unset), so once answered it's simply gone for the rest of the day.
//
// `delayed` is set when this page load is the moment someone just logged
// in (see WELCOME_COOKIE) — the backdrop appears immediately either way
// (so the page behind it doesn't flash unmasked), but the card itself
// waits out the homepage's own slide-in (globals.css's page-slide-in,
// 480ms) before popping up, so the two read as one sequence — the
// homepage arrives, then it asks — rather than the modal fighting the
// page for attention while it's still sliding in.
export function MoodCheckInModal({ dateISO, delayed = false }: { dateISO: string; delayed?: boolean }) {
  const [answered, setAnswered] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (answered) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm animate-[fade-in_300ms_ease-out_both]"
      style={delayed ? { animationDelay: "480ms" } : undefined}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-card p-7 text-center shadow-lg animate-[mood-modal-in_420ms_cubic-bezier(0.16,1,0.3,1)_both]"
        style={delayed ? { animationDelay: "480ms" } : undefined}
      >
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
