import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { UpdateNameForm } from "./UpdateNameForm";
import { RenameSubjectForm } from "./RenameSubjectForm";
import { PasswordForm } from "./PasswordForm";
import { UsernameForm } from "./UsernameForm";
import { EmailForm } from "./EmailForm";
import { UnitsForm } from "./UnitsForm";
import { NewSubjectForm } from "./NewSubjectForm";
import { NotificationsForm } from "./NotificationsForm";
import { DarkModeSwitch } from "./DarkModeSwitch";
import { HelpSection } from "./HelpSection";
import { FeedbackForm } from "./FeedbackForm";
import { DeleteSubjectButton } from "./DeleteSubjectButton";
import { AvatarUpload } from "./AvatarUpload";
import { ProfileForm } from "./ProfileForm";
import { DeleteAccountForm } from "./DeleteAccountForm";
import { ShareActivityToggle } from "../friends/ShareActivityToggle";
import { toggleUserPremium } from "./actions";
import { PremiumSection } from "./PremiumSection";
import { TrashSection } from "./TrashSection";
import { ScrollToHash } from "./ScrollToHash";
import { listTrashedItems } from "@/lib/trash";
import { getStripe, PREMIUM_PRICING } from "@/lib/stripe";
import {
  GearIcon,
  ClockIcon,
  DumbbellIcon,
  BellIcon,
  HelpIcon,
  MessageIcon,
  FlameIcon,
  JournalIcon,
  TargetIcon,
  MoonIcon,
  UsersIcon,
  UserIcon,
  TrophyIcon,
  ChartIcon,
} from "@/components/Icons";
import { formatLong, todayISO, shiftISO, daysBetween, shiftMonth, monthISOOf } from "@/lib/dates";
import { computeStreak } from "@/lib/streaks";
import { STREAK_FREEZES_PER_WINDOW } from "@/lib/limits";
import { levelForXp } from "@/lib/xp";
import { BADGE_INFO } from "@/lib/badges";
import { ADMIN_EMAIL } from "@/lib/auth";
import { fromKg, fromCm } from "@/lib/workout";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ premium?: string }> }) {
  const { premium } = await searchParams;
  const user = await getCurrentUser();
  const isAdmin = user.email === ADMIN_EMAIL;
  const [subjects, feedback, journalDates, subjectMinutes, studyDates, workoutDates, completedGoalDates, earnedBadges, allUsers] =
    await Promise.all([
      prisma.subject.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
      // The admin sees feedback from every account — otherwise another
      // user's feedback would just sit in their own account, invisible to
      // the one person who could actually act on it.
      isAdmin
        ? prisma.feedback.findMany({
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { user: { select: { name: true, email: true } } },
          })
        : prisma.feedback.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { user: { select: { name: true, email: true } } },
          }),
      prisma.journalEntry.findMany({
        where: { userId: user.id, bodyText: { not: "" } },
        select: { date: true },
      }),
      prisma.studySession.groupBy({
        by: ["subjectId"],
        where: { userId: user.id, durationMinutes: { not: null } },
        _sum: { durationMinutes: true },
      }),
      prisma.studySession.findMany({
        where: { userId: user.id, durationMinutes: { not: null } },
        select: { startedAt: true },
      }),
      prisma.workout.findMany({
        where: { userId: user.id, endedAt: { not: null } },
        select: { date: true },
      }),
      prisma.goalLog.findMany({
        where: { completed: true, goal: { userId: user.id } },
        select: { date: true },
      }),
      prisma.userBadge.findMany({ where: { userId: user.id }, select: { badge: true } }),
      // Visible to the admin only — sitting invisible in a database
      // nobody checks is the same as not having it at all.
      isAdmin
        ? prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, username: true, email: true, createdAt: true, emailVerifiedAt: true, isPremium: true },
          })
        : Promise.resolve([]),
    ]);
  const trashedItems = user.isPremium ? await listTrashedItems(user.id) : [];
  const minutesBySubject = new Map(subjectMinutes.map((s) => [s.subjectId, s._sum.durationMinutes ?? 0]));

  // Live plan details for the "manage plan" card — best-effort: a Stripe
  // outage or an unexpected response shape just means the renewal date is
  // omitted, not that the page breaks. Nothing here is persisted; it's
  // read fresh on every settings visit rather than cached, since this is
  // the one place it's shown.
  let planLabel: string | null = null;
  let renewsOn: string | null = null;
  let cancelAtPeriodEnd = false;
  if (user.isPremium && user.stripeSubscriptionId) {
    try {
      const subscription = await getStripe().subscriptions.retrieve(user.stripeSubscriptionId);
      const item = subscription.items.data[0];
      const interval = item?.price.recurring?.interval;
      const matchedPricing = interval === "year" ? PREMIUM_PRICING.year : interval === "month" ? PREMIUM_PRICING.month : null;
      planLabel = matchedPricing?.label ?? null;
      if (item?.current_period_end) renewsOn = formatLong(new Date(item.current_period_end * 1000).toISOString().slice(0, 10));
      cancelAtPeriodEnd = subscription.cancel_at_period_end;
    } catch (err) {
      console.error("Failed to fetch Stripe subscription details:", err);
    }
  }

  // Same "admin sees everyone's" reasoning as feedback above — a Report is
  // useless sitting invisible in the reporter's own account.
  const reports = isAdmin
    ? await prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          reporter: { select: { name: true, username: true } },
          targetUser: { select: { name: true, username: true } },
        },
      })
    : [];

  const today = todayISO();
  const usernameCooldownDaysLeft = user.usernameChangedAt
    ? Math.max(0, 7 - daysBetween(user.usernameChangedAt.toISOString().slice(0, 10), today))
    : 0;
  const maxFreezes = user.isPremium ? STREAK_FREEZES_PER_WINDOW.PREMIUM : STREAK_FREEZES_PER_WINDOW.FREE;
  const journaledDateSet = new Set(journalDates.map((e) => e.date.toISOString().slice(0, 10)));
  const journalStreak = computeStreak(journaledDateSet, today, maxFreezes);
  const totalEntries = journaledDateSet.size;
  const studyStreak = computeStreak(new Set(studyDates.map((s) => s.startedAt.toISOString().slice(0, 10))), today, maxFreezes);
  const workoutStreak = computeStreak(new Set(workoutDates.map((w) => w.date.toISOString().slice(0, 10))), today, maxFreezes);
  const goalsStreak = computeStreak(new Set(completedGoalDates.map((g) => g.date.toISOString().slice(0, 10))), today, maxFreezes);
  const { level, xpIntoLevel, xpForNextLevel } = levelForXp(user.xp);
  const earnedBadgeSet = new Set(earnedBadges.map((b) => b.badge));

  return (
    <div className="space-y-8">
      <PageHeader icon={GearIcon} iconClassName="text-ink-muted" title="Settings" className="" />
      <ScrollToHash />

      <section id="premium" className="rounded-2xl border border-line bg-card p-6 shadow-sm scroll-mt-6">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <TrophyIcon className="h-4 w-4 text-accent" />
          Proudly Premium
        </h2>
        {!user.isPremium && (
          <p className="mb-4 text-sm text-ink-muted">Everything below, unlocked — cancel any time.</p>
        )}
        <PremiumSection
          isPremium={user.isPremium}
          hasStripeSubscription={!!user.stripeSubscriptionId}
          justSubscribed={premium === "success"}
          planLabel={planLabel}
          renewsOn={renewsOn}
          cancelAtPeriodEnd={cancelAtPeriodEnd}
        />
      </section>

      <section id="profile" className="rounded-2xl border border-line bg-card p-6 shadow-sm scroll-mt-6">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <UserIcon className="h-4 w-4 text-ink-muted" />
          Profile
        </h2>
        <p className="mb-4 text-sm text-ink-muted">Your photo, name, username, and what shows on your public profile.</p>

        <AvatarUpload name={user.name} initialAvatarUrl={user.avatarUrl} />

        <UpdateNameForm name={user.name} />
        <p className="mt-1 text-xs text-ink-muted">First and last name.</p>

        <div className="mt-6 border-t border-line pt-6">
          <p className="mb-3 text-sm font-medium text-ink">Username</p>
          <UsernameForm current={user.username} cooldownDaysLeft={usernameCooldownDaysLeft} />
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <ProfileForm
            birthdayISO={user.birthday ? user.birthday.toISOString().slice(0, 10) : null}
            gender={user.gender}
            city={user.city}
            bio={user.bio}
            pronouns={user.pronouns}
            weight={user.weightKg != null ? fromKg(user.weightKg, user.weightUnit) : null}
            height={user.heightCm != null ? fromCm(user.heightCm, user.distanceUnit) : null}
            focusTags={user.focusTags}
            weightUnit={user.weightUnit}
            distanceUnit={user.distanceUnit}
          />
        </div>
      </section>

      <section id="account" className="rounded-2xl border border-line bg-card p-6 shadow-sm scroll-mt-6">
        <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Account &amp; Security</h2>
        <p className="mb-4 text-sm text-ink-muted">Your login email and password.</p>

        <div>
          <p className="mb-3 text-sm font-medium text-ink">Email</p>
          <EmailForm current={user.email} />
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <p className="mb-3 text-sm font-medium text-ink">Password</p>
          <PasswordForm />
        </div>
      </section>

      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <ChartIcon className="h-4 w-4 text-ink-muted" />
          <h2 className="font-serif text-lg font-semibold text-ink">Your progress</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-serif text-lg font-semibold text-ink">Level {level}</p>
            <p className="text-xs text-ink-muted">{user.xp} XP total</p>
          </div>
          <div className="w-full max-w-[220px] sm:w-auto">
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(xpIntoLevel / xpForNextLevel) * 100}%` }} />
            </div>
            <p className="mt-1 text-right text-[11px] text-ink-muted">
              {xpIntoLevel}/{xpForNextLevel} to level {level + 1}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div className="flex items-center gap-2">
            <JournalIcon className="h-5 w-5 shrink-0 text-accent" />
            <div>
              <p className="font-serif text-base font-semibold text-ink">{journalStreak}</p>
              <p className="text-xs text-ink-muted">journal streak</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5 shrink-0 text-study" />
            <div>
              <p className="font-serif text-base font-semibold text-ink">{studyStreak}</p>
              <p className="text-xs text-ink-muted">study streak</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DumbbellIcon className="h-5 w-5 shrink-0 text-workout" />
            <div>
              <p className="font-serif text-base font-semibold text-ink">{workoutStreak}</p>
              <p className="text-xs text-ink-muted">workout streak</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TargetIcon className="h-5 w-5 shrink-0 text-goals" />
            <div>
              <p className="font-serif text-base font-semibold text-ink">{goalsStreak}</p>
              <p className="text-xs text-ink-muted">goals streak</p>
            </div>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
          ❄️ Streak freeze: miss {maxFreezes} day{maxFreezes === 1 ? "" : "s"} every 7 without losing a streak
          {!user.isPremium && (
            <>
              {" · "}
              <Link href="/settings#premium" className="font-medium text-accent hover:underline">
                Premium gets {STREAK_FREEZES_PER_WINDOW.PREMIUM}
              </Link>
            </>
          )}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
          <FlameIcon className="h-3.5 w-3.5 text-accent" />
          {totalEntries} journal {totalEntries === 1 ? "entry" : "entries"} written in total
        </p>
        <p className="mt-2 text-xs">
          <Link href={`/?week=${shiftISO(today, -7)}#recap`} className="text-accent hover:underline">
            Browse past weekly recaps →
          </Link>
        </p>
        <p className="mt-1 text-xs">
          <Link href={`/?month=${shiftMonth(monthISOOf(today), -1)}#monthly-recap`} className="text-accent hover:underline">
            Browse past monthly recaps →
          </Link>
        </p>
        {user.isPremium && (
          <p className="mt-1 text-xs">
            <a href={`/api/export/recap/yearly?year=${today.slice(0, 4)}`} className="text-accent hover:underline">
              📄 Download this year&apos;s recap (PDF) →
            </a>
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Badges</h2>
        <p className="mb-4 text-sm text-ink-muted">
          {earnedBadgeSet.size} of {Object.keys(BADGE_INFO).length} earned
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {(Object.keys(BADGE_INFO) as (keyof typeof BADGE_INFO)[]).map((badge) => {
            const info = BADGE_INFO[badge];
            const earned = earnedBadgeSet.has(badge);
            return (
              <div
                key={badge}
                title={info.description}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center ${
                  earned ? "border-accent-soft bg-accent-soft" : "border-line opacity-40 grayscale"
                }`}
              >
                <span className="text-2xl">{info.emoji}</span>
                <span className="text-[11px] font-medium leading-tight text-ink">{info.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {user.isPremium && (
        <section id="recently-deleted" className="rounded-2xl border border-line bg-card p-6 shadow-sm scroll-mt-6">
          <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Recently deleted</h2>
          <p className="mb-4 text-sm text-ink-muted">
            Deleted goals and workouts stay here for 30 days before they&apos;re gone for good.
          </p>
          <TrashSection items={trashedItems} />
        </section>
      )}

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Preferences</h2>
        <p className="mb-4 text-sm text-ink-muted">Appearance, notifications, and display units.</p>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MoonIcon className="h-4 w-4 text-ink-muted" />
            <p className="text-sm font-medium text-ink">Appearance</p>
          </div>
          <DarkModeSwitch />
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <div className="mb-3 flex items-center gap-2">
            <BellIcon className="h-4 w-4 text-accent" />
            <p className="text-sm font-medium text-ink">Notifications</p>
          </div>
          <p className="mb-3 text-sm text-ink-muted">Reminders for individual goals, sent as a browser push.</p>
          <NotificationsForm />
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <div className="mb-3 flex items-center gap-2">
            <DumbbellIcon className="h-4 w-4 text-workout" />
            <p className="text-sm font-medium text-ink">Workout units</p>
          </div>
          <p className="mb-3 text-sm text-ink-muted">What weight and distance are shown in on the Workout page.</p>
          <UnitsForm weightUnit={user.weightUnit} distanceUnit={user.distanceUnit} />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Privacy &amp; Data</h2>
        <p className="mb-4 text-sm text-ink-muted">What friends can see, and a copy of everything you&apos;ve stored here.</p>

        <div className="flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-calm" />
          <p className="text-sm font-medium text-ink">Sharing</p>
        </div>
        <p className="mb-3 text-sm text-ink-muted">
          Your journal is never visible to anyone, followers included. These only ever cover streaks, never content.
        </p>
        <ShareActivityToggle
          initial={{
            journal: user.shareJournalStreak,
            study: user.shareStudyStreak,
            workout: user.shareWorkoutStreak,
          }}
        />

        <div className="mt-6 border-t border-line pt-6">
          <p className="mb-2 text-sm font-medium text-ink">Your data</p>
          <a
            href="/api/export"
            download
            className="inline-block rounded-lg border border-line px-4 py-2 text-sm text-ink-muted hover:border-accent hover:text-accent"
          >
            Download my data (JSON)
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <ClockIcon className="h-4 w-4 text-study" />
          Study subjects
        </h2>
        <p className="mb-4 text-sm text-ink-muted">Rename or delete the ones you have.</p>

        {subjects.length === 0 && <p className="mb-4 text-sm text-ink-muted">No subjects yet.</p>}

        <ul className="mb-4 space-y-2">
          {subjects.map((subject) => (
            <li key={subject.id} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
              <RenameSubjectForm subjectId={subject.id} name={subject.name} />
              <DeleteSubjectButton subjectId={subject.id} name={subject.name} minutes={minutesBySubject.get(subject.id) ?? 0} />
            </li>
          ))}
        </ul>

        <NewSubjectForm />
      </section>

      {isAdmin && (
        <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
            <UsersIcon className="h-4 w-4 text-calm" />
            Users ({allUsers.length})
          </h2>
          <p className="mb-4 text-sm text-ink-muted">Everyone who&apos;s signed up, most recent first.</p>
          <ul className="-mx-6 divide-y divide-line border-t border-line">
            {allUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-ink">
                    {u.name} <span className="text-ink-muted">@{u.username}</span>
                    {u.isPremium && <span className="ml-1.5 text-xs text-accent">· Premium</span>}
                  </p>
                  <p className="truncate text-xs text-ink-muted">{u.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right text-xs text-ink-muted">
                    <p>{formatLong(u.createdAt.toISOString().slice(0, 10))}</p>
                    <p className={u.emailVerifiedAt ? "text-accent" : ""}>{u.emailVerifiedAt ? "Verified" : "Unverified"}</p>
                  </div>
                  <form action={toggleUserPremium.bind(null, u.id)}>
                    <button
                      type="submit"
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        u.isPremium ? "border-accent text-accent hover:bg-accent-soft" : "border-line text-ink-muted hover:border-accent hover:text-accent"
                      }`}
                    >
                      {u.isPremium ? "Remove" : "Make premium"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <HelpIcon className="h-4 w-4 text-ink-muted" />
          Support
        </h2>
        <p className="mb-4 text-sm text-ink-muted">Common questions, and a way to reach us directly.</p>
        <HelpSection />

        <div className="mt-6 border-t border-line pt-6">
          <div className="mb-3 flex items-center gap-2">
            <MessageIcon className="h-4 w-4 text-accent" />
            <p className="text-sm font-medium text-ink">Send feedback</p>
          </div>
          <p className="mb-3 text-sm text-ink-muted">
            Bugs, ideas, things that annoy you. This goes straight to Oliver, not an app store review.
          </p>
          <FeedbackForm />

          {feedback.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-ink-muted">{isAdmin ? "All feedback" : "Previously sent"}</p>
              <ul className="-mx-6 divide-y divide-line border-t border-line">
                {feedback.map((f) => (
                  <li key={f.id} className="px-6 py-2.5 text-sm">
                    <p className="text-ink">{f.message}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {isAdmin && `${f.user.name} (${f.user.email}) · `}
                      {formatLong(f.createdAt.toISOString().slice(0, 10))}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isAdmin && (
            <div className="mt-5 border-t border-line pt-5">
              <p className="mb-2 text-xs font-medium text-ink-muted">Reports ({reports.length})</p>
              {reports.length === 0 ? (
                <p className="text-sm text-ink-muted">Nothing reported.</p>
              ) : (
                <ul className="-mx-6 divide-y divide-line border-t border-line">
                  {reports.map((r) => (
                    <li key={r.id} className="px-6 py-2.5 text-sm">
                      <p className="text-ink">{r.reason}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {r.reporter.name} (@{r.reporter.username}) reported {r.targetUser.name} (@{r.targetUser.username}) ·{" "}
                        {r.targetType.replace("_", " ").toLowerCase()} · {formatLong(r.createdAt.toISOString().slice(0, 10))}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      <p className="text-center text-xs text-ink-muted">
        <Link href="/privacy" className="hover:text-accent hover:underline">
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/terms" className="hover:text-accent hover:underline">
          Terms of Service
        </Link>
      </p>

      <section className="rounded-2xl border border-workout/30 bg-card p-6 shadow-sm">
        <h2 className="mb-1 font-serif text-lg font-semibold text-workout">Danger Zone</h2>
        <p className="mb-4 text-sm text-ink-muted">Permanently delete your account and everything in it.</p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
