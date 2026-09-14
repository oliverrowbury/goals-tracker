"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { JournalIcon, TargetIcon, ClockIcon, DumbbellIcon, GearIcon, CalendarIcon, AlarmIcon, UsersIcon } from "@/components/Icons";

const LINKS = [
  { href: "/journal", label: "Journal", Icon: JournalIcon, color: "accent" },
  { href: "/goals", label: "Goals", Icon: TargetIcon, color: "goals" },
  { href: "/deadlines", label: "Deadlines", Icon: AlarmIcon, color: "accent" },
  { href: "/study", label: "Study", Icon: ClockIcon, color: "study" },
  { href: "/workout", label: "Workout", Icon: DumbbellIcon, color: "workout" },
  { href: "/friends", label: "Friends", Icon: UsersIcon, color: "calm" },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon, color: "ink" },
  { href: "/settings", label: "Settings", Icon: GearIcon, color: "ink" },
] as const;

// Section color varies per link (Journal is the main accent, Goals/Study/
// Workout keep their own hue), so the active pill's classes have to be
// spelled out per color rather than built from a template string — Tailwind
// only picks up class names it can find literally in the source.
const ACTIVE_CLASSES: Record<(typeof LINKS)[number]["color"], string> = {
  accent: "bg-accent-soft text-accent",
  goals: "bg-goals-soft text-goals",
  study: "bg-study-soft text-study",
  workout: "bg-workout-soft text-workout",
  calm: "bg-calm-soft text-calm",
  ink: "bg-line text-ink",
};

const HOVER_CLASSES: Record<(typeof LINKS)[number]["color"], string> = {
  accent: "hover:text-accent",
  goals: "hover:text-goals",
  study: "hover:text-study",
  workout: "hover:text-workout",
  calm: "hover:text-calm",
  ink: "hover:text-ink",
};

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map(({ href, label, Icon, color }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg p-2 -m-0.5 transition-colors ${
              active ? ACTIVE_CLASSES[color] : `text-ink-muted ${HOVER_CLASSES[color]}`
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </>
  );
}
