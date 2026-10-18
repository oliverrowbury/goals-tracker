"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { PREMIUM_PRICING } from "@/lib/stripe";

// Tailwind needs each class written out in full somewhere in the source to
// generate it (a template-built "bg-${color}" string is invisible to its
// content scan), so the dot color is a literal class per pillar rather
// than interpolated from a shared "color" field.
const PILLARS = [
  { name: "Journal", dotClassName: "bg-accent" },
  { name: "Goals", dotClassName: "bg-goals" },
  { name: "Study", dotClassName: "bg-study" },
  { name: "Workout", dotClassName: "bg-workout" },
] as const;

// Matches globals.css's card-out duration — the card finishes animating
// out right as the real navigation lands, so the destination page's own
// card-in entrance (login/signup already have one) picks up the motion
// instead of there being a blank gap between the two.
const EXIT_ANIMATION_MS = 380;

export function WelcomeCard() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  function goTo(destination: "login" | "signup") {
    setLeaving(true);
    setTimeout(() => router.push(`/${destination}`), EXIT_ANIMATION_MS);
  }

  return (
    <div
      className={`relative z-10 w-full max-w-sm rounded-2xl border border-line bg-card p-7 shadow-lg ${
        leaving
          ? "animate-[card-out_0.4s_cubic-bezier(0.4,0,1,1)_both]"
          : "animate-[card-in_0.75s_cubic-bezier(0.16,1,0.3,1)_both]"
      }`}
    >
      <h1 className="mb-1 text-2xl text-ink">
        <Wordmark animated />
      </h1>

      <div className="animate-[fade-up_0.6s_cubic-bezier(0.16,1,0.3,1)_both] [animation-delay:1s]">
        <span className="mt-4 inline-flex rounded-full bg-accent-soft px-3 py-1.5 text-[0.78rem] font-medium text-accent-strong">
          Built by a 17-year-old student, for mental wellbeing
        </span>
        <h2 className="mt-3 text-balance font-serif text-[1.7rem] font-semibold leading-[1.15] text-ink">
          Proof you showed up today.
        </h2>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-muted">
          A daily journal for what you&apos;re actually proud of, with goals, study time, and workouts tracked right
          alongside it. No guilt-tripping, no streak shame.
        </p>

        <div className="mt-[18px] grid grid-cols-4 gap-2">
          {PILLARS.map((p) => (
            <div key={p.name} className="rounded-xl border border-line px-1 py-2.5 text-center">
              <span className={`mx-auto mb-1.5 block h-[7px] w-[7px] rounded-full ${p.dotClassName}`} />
              <span className="text-[0.7rem] font-medium text-ink">{p.name}</span>
            </div>
          ))}
        </div>

        <div className="mt-[22px] flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => goTo("signup")}
            disabled={leaving}
            className="btn-sheen relative w-full overflow-hidden rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98] disabled:opacity-60"
          >
            Start free, no card needed
          </button>
          <button
            type="button"
            onClick={() => goTo("login")}
            disabled={leaving}
            className="w-full rounded-lg border border-line px-4 py-3 text-sm font-medium text-ink transition hover:border-accent hover:text-accent disabled:opacity-60"
          >
            Log in
          </button>
        </div>
        <p className="mt-3 text-center text-[0.78rem] text-ink-muted">
          Free forever for the basics. Premium from {PREMIUM_PRICING.month.label}.
        </p>

        <p className="mt-5 border-t border-line pt-4 text-center text-[0.74rem] text-ink-muted">
          <Link href="/privacy" className="hover:text-accent">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/terms" className="hover:text-accent">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  );
}
