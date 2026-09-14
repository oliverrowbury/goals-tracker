"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon } from "@/components/Icons";

const STORAGE_KEY = "onboarding-dismissed";

type Step = { done: boolean; label: string; href: string; cta: string };

export function OnboardingChecklist({
  hasSubject,
  hasWorkout,
  hasJournalEntry,
}: {
  hasSubject: boolean;
  hasWorkout: boolean;
  hasJournalEntry: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      // Deferred to an effect rather than a lazy useState initializer for
      // the same reason as JournalEditor's useFieldMode — the server
      // always renders "not dismissed" (it can't see localStorage), so
      // reading it during the client's first render would disagree with
      // that and trip a hydration mismatch. A brief flash before it hides
      // is an acceptable trade for not fighting hydration over this.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(STORAGE_KEY) === "1") setDismissed(true);
    } catch {
      // ignore — just stays shown
    }
  }, []);

  const steps: Step[] = [
    { done: hasJournalEntry, label: "Write a journal entry", href: "/journal", cta: "Write one →" },
    { done: hasSubject, label: "Add a study subject", href: "/study", cta: "Add one →" },
    { done: hasWorkout, label: "Log a workout", href: "/workout", cta: "Log one →" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  if (dismissed || doneCount === steps.length) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // not persisted this session — not worth surfacing
    }
  }

  return (
    <div className="relative mb-6 animate-[fade-up_0.5s_ease-out] rounded-2xl border border-line bg-card p-5 shadow-sm">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 p-1.5 -m-1.5 text-ink-muted hover:text-ink"
      >
        ×
      </button>
      <p className="pr-6 font-serif text-lg font-semibold text-ink">Get set up</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        {doneCount} of {steps.length} done
      </p>
      <ul className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                step.done ? "border-accent bg-accent text-white" : "border-line text-transparent"
              }`}
            >
              <CheckIcon className="h-3 w-3" />
            </span>
            <span className={step.done ? "text-ink-muted line-through" : "text-ink"}>{step.label}</span>
            {!step.done && (
              <Link href={step.href} className="ml-auto shrink-0 text-accent hover:underline">
                {step.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
