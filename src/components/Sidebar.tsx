"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  JournalIcon,
  TargetIcon,
  ClockIcon,
  DumbbellIcon,
  GearIcon,
  CalendarIcon,
  AlarmIcon,
  UsersIcon,
  MessageIcon,
  SignOutIcon,
  MenuIcon,
  CloseIcon,
} from "@/components/Icons";

const LINKS = [
  { href: "/journal", label: "Journal", Icon: JournalIcon, color: "accent" },
  { href: "/goals", label: "Goals", Icon: TargetIcon, color: "goals" },
  { href: "/deadlines", label: "Deadlines", Icon: AlarmIcon, color: "accent" },
  { href: "/study", label: "Study", Icon: ClockIcon, color: "study" },
  { href: "/workout", label: "Workout", Icon: DumbbellIcon, color: "workout" },
  { href: "/friends", label: "Friends", Icon: UsersIcon, color: "calm" },
  { href: "/messages", label: "Messages", Icon: MessageIcon, color: "calm" },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon, color: "ink" },
  { href: "/settings", label: "Settings", Icon: GearIcon, color: "ink" },
] as const;

// Section color varies per link (Journal is the main accent, Goals/Study/
// Workout keep their own hue), so the active row's classes have to be
// spelled out per color rather than built from a template string —
// Tailwind only picks up class names it can find literally in the source.
const ACTIVE_CLASSES: Record<(typeof LINKS)[number]["color"], string> = {
  accent: "bg-accent-soft text-accent",
  goals: "bg-goals-soft text-goals",
  study: "bg-study-soft text-study",
  workout: "bg-workout-soft text-workout",
  calm: "bg-calm-soft text-calm",
  ink: "bg-line text-ink",
};

export function Sidebar({ level, unreadMessageCount = 0 }: { level: number; unreadMessageCount?: number }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const links = (
    <nav className="flex flex-1 flex-col gap-0.5">
      {LINKS.map(({ href, label, Icon, color }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? ACTIVE_CLASSES[color] : "text-ink-muted hover:bg-line/60 hover:text-ink"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
            {href === "/messages" && unreadMessageCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-calm px-1.5 text-xs font-medium text-white">
                {unreadMessageCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const accountRow = (
    <div className="flex items-center justify-between border-t border-line pt-3">
      <Link
        href="/settings"
        onClick={() => setMobileOpen(false)}
        className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent hover:opacity-80"
      >
        Lv {level}
      </Link>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <form action="/api/logout" method="POST" className="flex">
          <button type="submit" title="Sign out" className="p-1.5 -m-0.5 text-ink-muted hover:text-accent">
            <SignOutIcon className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar — just enough to open the menu; everything else
          (links, level, theme, sign out) lives in the drawer below rather
          than being duplicated up here too. Fixed (not in normal flow) so
          it doesn't become a flex sibling of the desktop aside/main content
          row in the layout above — main compensates with top padding on
          mobile (see (main)/layout.tsx). */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-line bg-card px-4 py-3 sm:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-1.5 -m-1.5 text-ink-muted hover:text-ink"
        >
          <MenuIcon className="h-6 w-6" />
        </button>
        <Link href="/" className="text-lg text-ink">
          <Wordmark />
        </Link>
        <span className="w-9" aria-hidden="true" />
      </div>

      {/* Mobile drawer — a full vertical list rather than a horizontal bar
          that either scrolls or keeps shrinking every time a section gets
          added, which is what this replaces. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-card p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <Link href="/" onClick={() => setMobileOpen(false)} className="text-xl text-ink">
                <Wordmark />
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="p-1.5 -m-1.5 text-ink-muted hover:text-ink"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            {links}
            <div className="mt-4">{accountRow}</div>
          </div>
        </div>
      )}

      {/* Desktop — persistent, always visible, no scrolling or drawer
          needed since a vertical list has room for every section. */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-card p-4 sm:flex">
        <Link href="/" className="mb-5 px-1 text-xl text-ink">
          <Wordmark />
        </Link>
        {links}
        <div className="mt-4">{accountRow}</div>
      </aside>
    </>
  );
}
