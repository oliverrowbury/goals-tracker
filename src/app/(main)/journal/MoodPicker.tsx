"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setMood } from "./actions";
import { MOODS } from "@/lib/mood";

export function MoodPicker({ dateISO, initialMood }: { dateISO: string; initialMood: number | null }) {
  const [mood, setMoodState] = useState(initialMood);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mb-6 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-sm font-medium text-ink-muted">How was today?</span>
      {MOODS.map((m) => (
        <button
          key={m.value}
          type="button"
          title={m.label}
          disabled={isPending}
          onClick={() => {
            setMoodState(m.value); // optimistic
            startTransition(() => {
              setMood(dateISO, m.value);
            });
          }}
          className={`rounded-full p-1.5 text-xl transition-transform hover:scale-110 ${
            mood === m.value ? "bg-accent-soft ring-2 ring-accent" : "opacity-50 hover:opacity-100"
          }`}
        >
          {m.face}
        </button>
      ))}
      <Link href="/breathe" className="ml-2 text-sm text-ink-muted underline decoration-line hover:text-accent">
        Need a moment? Breathe →
      </Link>
    </div>
  );
}
