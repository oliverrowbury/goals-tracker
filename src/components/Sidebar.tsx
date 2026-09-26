"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toggleSidebarCollapsed } from "@/lib/sidebarCollapsed";
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
  ChevronDownIcon,
} from "@/components/Icons";

// The collapsed sidebar's logo — the ascending-bars mark from Wordmark,
// without the "Proudly" text (which won't fit at icon width), given the
// same rounded-badge treatment as every other icon-in-a-soft-square in
// this app (PageHeader, WorkoutSummary's icon, etc.) rather than just
// floating bare bars in the corner — an actual app-icon mark, not a raw
// chart glyph. Kept local rather than added to Wordmark itself, since
// nowhere else needs an icon-only variant.
const BAR_HEIGHTS_PX = [6, 10, 14, 18];
function SidebarLogoIcon() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft" aria-hidden="true">
      <span className="inline-flex items-end gap-[3px]">
        {BAR_HEIGHTS_PX.map((h, i) => (
          <span
            key={i}
            className="block w-[3px] origin-bottom rounded-t-[1px] bg-gradient-to-t from-accent to-accent-strong"
            style={{ height: `${h}px` }}
          />
        ))}
      </span>
    </span>
  );
}

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

export function Sidebar({
  level,
  unreadMessageCount = 0,
  friendsNotificationCount = 0,
  notificationBell,
}: {
  level: number;
  unreadMessageCount?: number;
  friendsNotificationCount?: number;
  // Rendered in the mobile top bar's right slot (previously an empty
  // spacer reserved only to keep the wordmark centered) — the desktop
  // equivalent lives in (main)/layout.tsx's own toolbar row instead, since
  // there's no persistent top bar here to slot it into on wider screens.
  notificationBell?: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Orange (the app's one accent color) rather than each link's own
  // section color — a notification count needs to read as "something to
  // look at" regardless of which section it's attached to.
  const BADGE_COUNTS: Partial<Record<string, number>> = {
    "/messages": unreadMessageCount,
    "/friends": friendsNotificationCount,
  };

  const links = (
    <nav className="flex flex-1 flex-col gap-0.5">
      {LINKS.map(({ href, label, Icon, color }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const badgeCount = BADGE_COUNTS[href] ?? 0;
        return (
          <Link
            key={href}
            href={href}
            title={label}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? ACTIVE_CLASSES[color] : "text-ink-muted hover:bg-line/60 hover:text-ink"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="sidebar-label">{label}</span>
            {badgeCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-white">
                {badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const accountRow = (
    <div className="account-row flex items-center justify-between border-t border-line pt-3">
      <Link
        href="/settings"
        onClick={() => setMobileOpen(false)}
        title={`Level ${level}`}
        className="sidebar-account-label rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent hover:opacity-80"
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
        {notificationBell ?? <span className="w-9" aria-hidden="true" />}
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
          needed since a vertical list has room for every section.
          sticky + h-screen + self-start pins it to the actual viewport
          instead of stretching to match main's height (the flex row's
          default align-items: stretch) — without this, the account row
          at the bottom only stayed on-screen on a page short enough to
          fit in one view (Calendar), and got pushed below the fold on
          anything longer. `app-sidebar` is the hook globals.css uses to
          shrink this to icon-only width when collapsed — see the
          "sidebar-collapsed" rules there and SIDEBAR_INIT_SCRIPT in the
          root layout for how that class gets applied before paint. */}
      <aside className="app-sidebar hidden w-56 shrink-0 flex-col border-r border-line bg-card p-4 sm:sticky sm:top-0 sm:flex sm:h-screen sm:self-start sm:overflow-y-auto">
        <div className="sidebar-header mb-5 flex items-center justify-between px-1">
          <Link href="/" className="sidebar-logo-full text-xl text-ink">
            <Wordmark />
          </Link>
          <Link href="/" className="sidebar-logo-icon hidden text-ink" aria-label="Proudly">
            <SidebarLogoIcon />
          </Link>
          <button
            type="button"
            onClick={() => toggleSidebarCollapsed()}
            title="Collapse sidebar"
            className="chevron-collapse flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-line/60 hover:text-ink"
          >
            <ChevronDownIcon className="h-4 w-4 rotate-90" />
          </button>
          <button
            type="button"
            onClick={() => toggleSidebarCollapsed()}
            title="Expand sidebar"
            className="chevron-expand hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-line/60 hover:text-ink"
          >
            <ChevronDownIcon className="h-4 w-4 -rotate-90" />
          </button>
        </div>
        {links}
        <div className="mt-4">{accountRow}</div>
      </aside>
    </>
  );
}
