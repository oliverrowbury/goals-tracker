import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { JournalIcon, ClockIcon, DumbbellIcon, CheckIcon } from "@/components/Icons";
import { BADGE_INFO } from "@/lib/badgeInfo";
import { PREMIUM_PRICING } from "@/lib/stripe";

// No metadata export — this is the bare-brand page the root layout's
// title template is meant for (see layout.tsx's own comment), so it falls
// back to the default "Proudly" instead of becoming "Proudly · Proudly".

// Tailwind needs each class written out in full somewhere in the source to
// generate it (a template-built "bg-${color}" string is invisible to its
// content scan), so the dot color is a literal class per pillar rather
// than interpolated from a shared "color" field.
const PILLARS = [
  {
    name: "Journal",
    dotClassName: "bg-accent",
    description: "A daily prompt, mood check-in, and space to write what actually happened. Private by default, always.",
  },
  {
    name: "Goals",
    dotClassName: "bg-goals",
    description: "Daily, weekly, or specific-days targets that tick themselves off when you log the work elsewhere in the app.",
  },
  {
    name: "Study",
    dotClassName: "bg-study",
    description: "A real timer per subject, with auto-pause when you switch tabs, so the number is actually honest.",
  },
  {
    name: "Workout",
    dotClassName: "bg-workout",
    description: "Log sets and reps or track a run with GPS splits. Your call, same tracker either way.",
  },
] as const;

const SHOWCASE_BADGES: { badge: keyof typeof BADGE_INFO; earned: boolean }[] = [
  { badge: "FIRST_JOURNAL_ENTRY", earned: true },
  { badge: "JOURNAL_STREAK_7", earned: true },
  { badge: "FIRST_GOAL_COMPLETE", earned: true },
  { badge: "TOTAL_WORKOUTS_50", earned: false },
  { badge: "TOTAL_STUDY_HOURS_50", earned: false },
  { badge: "LEVEL_50", earned: false },
];

const PERKS = [
  "Unlimited goals, deadlines & subjects",
  "A second streak freeze, and an earlier deadline reminder",
  "Exclusive badges, profile flair, PDF recaps emailed to you",
  "AI workout advice and a personalized daily prompt",
];

export default function WelcomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4">
      <nav className="flex items-center justify-between py-5">
        <span className="text-xl text-ink">
          <Wordmark />
        </span>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/login" className="text-ink-muted hover:text-accent">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98]"
          >
            Start free
          </Link>
        </div>
      </nav>

      <section className="grid items-center gap-10 py-10 md:grid-cols-[1.05fr_1fr] md:py-16">
        <div>
          <span className="inline-flex rounded-full bg-accent-soft px-3 py-1.5 text-[0.78rem] font-medium text-accent-strong">
            Built by a 17-year-old student, for improving mental wellbeing
          </span>
          <h1 className="mt-4 text-balance font-serif text-4xl font-semibold leading-[1.05] text-ink sm:text-5xl">
            Proof you showed up today.
          </h1>
          <p className="mt-4 max-w-md text-[1.08rem] leading-relaxed text-ink-muted">
            A daily journal for what you&apos;re actually proud of, with goals, study time, and workouts tracked right
            alongside it. No guilt-tripping, no streak shame. Just an honest record of the effort you&apos;re putting
            in.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-accent px-6 py-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98]"
            >
              Start free, no card needed
            </Link>
            <a
              href="#pillars"
              className="rounded-lg border border-line px-6 py-3.5 text-sm font-medium text-ink transition hover:border-accent hover:text-accent"
            >
              See how it works
            </a>
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            Free forever for the basics. Premium from {PREMIUM_PRICING.month.label}.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-card p-5 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-serif text-lg font-semibold text-ink">Good evening 👋</span>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">Level 7</span>
          </div>
          <div className="mb-4 rounded-xl border border-line bg-paper p-4">
            <p className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-accent">
              Proudly Prompt of the Day
            </p>
            <p className="font-serif text-[0.98rem] font-semibold leading-snug text-ink">
              What&apos;s something you did today that felt genuinely like you?
            </p>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-line bg-card p-2.5 text-center">
              <JournalIcon className="mx-auto h-4 w-4 text-accent" />
              <p className="mt-1 font-serif text-lg font-semibold text-ink">12</p>
              <p className="text-[0.66rem] text-ink-muted">journal streak</p>
            </div>
            <div className="rounded-xl border border-line bg-card p-2.5 text-center">
              <ClockIcon className="mx-auto h-4 w-4 text-study" />
              <p className="mt-1 font-serif text-lg font-semibold text-ink">5</p>
              <p className="text-[0.66rem] text-ink-muted">study streak</p>
            </div>
            <div className="rounded-xl border border-line bg-card p-2.5 text-center">
              <DumbbellIcon className="mx-auto h-4 w-4 text-workout" />
              <p className="mt-1 font-serif text-lg font-semibold text-ink">3</p>
              <p className="text-[0.66rem] text-ink-muted">workout streak</p>
            </div>
          </div>
          <div className="border-t border-line pt-3">
            <div className="mb-1.5 flex justify-between text-xs text-ink-muted">
              <span>640 XP</span>
              <span>360 to Level 8</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full w-[64%] rounded-full bg-accent" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line py-7">
        <div className="grid grid-cols-[auto_1fr] items-start gap-4">
          <span className="font-serif text-4xl leading-none text-calm">&quot;</span>
          <div>
            <p className="max-w-xl font-serif text-lg leading-relaxed text-ink">
              I built Proudly because I kept finishing a rough week of revision and genuinely couldn&apos;t tell if
              I&apos;d done anything at all. It&apos;s meant to make that visible, without turning it into another
              thing to feel guilty about.
            </p>
            <p className="mt-2 text-sm text-ink-muted">Oliver, 17, the person who built this</p>
          </div>
        </div>
      </section>

      <section id="pillars" className="py-12">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">What&apos;s actually in it</p>
        <h2 className="max-w-[26ch] font-serif text-3xl font-semibold text-ink">Four things, one streak to keep.</h2>
        <p className="mt-3 max-w-xl text-ink-muted">
          Most apps make you choose between a journal, a habit tracker, a study timer, and a workout log. Proudly
          treats them as one record of your day, not four separate chores.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.name} className="rounded-2xl border border-line bg-card p-5">
              <span className={`mb-3.5 block h-2.5 w-2.5 rounded-full ${p.dotClassName}`} />
              <h3 className="mb-1.5 font-serif text-base font-semibold text-ink">{p.name}</h3>
              <p className="text-sm leading-relaxed text-ink-muted">{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Why it sticks</p>
        <h2 className="max-w-[26ch] font-serif text-3xl font-semibold text-ink">Built to forgive a bad week, not punish it.</h2>
        <p className="mt-3 max-w-xl text-ink-muted">
          Every pillar keeps its own streak, with a freeze day built in so one off day doesn&apos;t wipe out three
          weeks of showing up. Badges unlock as you go. Some are obvious, some you&apos;ll stumble into.
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5">
          {SHOWCASE_BADGES.map(({ badge, earned }) => {
            const info = BADGE_INFO[badge];
            return (
              <div
                key={badge}
                className={`flex w-24 flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center ${
                  earned ? "border-accent-soft bg-accent-soft" : "border-line opacity-40 grayscale"
                }`}
              >
                <span className="text-2xl">{info.emoji}</span>
                <span className="text-[0.66rem] font-medium leading-tight text-ink">{info.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-12">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">If you want more</p>
        <h2 className="max-w-[26ch] font-serif text-3xl font-semibold text-ink">Premium, for when the free limits get in the way.</h2>
        <div className="mt-7 grid gap-7 rounded-2xl border border-line bg-card p-7 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-ink-muted">
              Everything above is free, with sensible caps on goals, deadlines, and subjects. Premium removes the
              caps and adds the rest:
            </p>
            <ul className="mt-4 space-y-2 text-sm text-ink">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-accent bg-accent-soft p-5 text-center">
            <p className="font-serif text-3xl font-semibold text-accent-strong">{PREMIUM_PRICING.month.label.split("/")[0]}</p>
            <p className="mt-0.5 text-sm text-ink-muted">per month</p>
            <p className="mt-2.5 text-xs text-ink-muted">or {PREMIUM_PRICING.year.label}, save ~£18</p>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-8 text-sm">
        <span className="text-xl text-ink">
          <Wordmark />
        </span>
        <div className="flex gap-5 text-ink-muted">
          <Link href="/privacy" className="hover:text-accent">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-accent">
            Terms of Service
          </Link>
        </div>
      </footer>
    </main>
  );
}
