import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { setSubjectActive } from "./actions";
import { UpdateNameForm } from "./UpdateNameForm";
import { RenameSubjectForm } from "./RenameSubjectForm";
import { PasswordForm } from "./PasswordForm";
import { UsernameForm } from "./UsernameForm";
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
} from "@/components/Icons";
import { formatLong, todayISO, shiftISO, daysBetween } from "@/lib/dates";
import { computeStreak } from "@/lib/streaks";
import { levelForXp } from "@/lib/xp";
import { BADGE_INFO } from "@/lib/badges";
import { ADMIN_EMAIL } from "@/lib/auth";
import { fromKg, fromCm } from "@/lib/workout";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const isAdmin = user.email === ADMIN_EMAIL;
  const [subjects, feedback, journalDates, subjectMinutes, studyDates, workoutDates, completedGoalDates, earnedBadges] =
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
    ]);
  const active = subjects.filter((s) => s.active);
  const archived = subjects.filter((s) => !s.active);
  const minutesBySubject = new Map(subjectMinutes.map((s) => [s.subjectId, s._sum.durationMinutes ?? 0]));

  const today = todayISO();
  const usernameCooldownDaysLeft = user.usernameChangedAt
    ? Math.max(0, 7 - daysBetween(user.usernameChangedAt.toISOString().slice(0, 10), today))
    : 0;
  const journaledDateSet = new Set(journalDates.map((e) => e.date.toISOString().slice(0, 10)));
  const journalStreak = computeStreak(journaledDateSet, today);
  const totalEntries = journaledDateSet.size;
  const studyStreak = computeStreak(new Set(studyDates.map((s) => s.startedAt.toISOString().slice(0, 10))), today);
  const workoutStreak = computeStreak(new Set(workoutDates.map((w) => w.date.toISOString().slice(0, 10))), today);
  const goalsStreak = computeStreak(new Set(completedGoalDates.map((g) => g.date.toISOString().slice(0, 10))), today);
  const { level, xpIntoLevel, xpForNextLevel } = levelForXp(user.xp);
  const earnedBadgeSet = new Set(earnedBadges.map((b) => b.badge));

  return (
    <div className="space-y-8">
      <PageHeader icon={GearIcon} iconClassName="text-ink-muted" title="Settings" className="" />

      <section id="account" className="rounded-2xl border border-line bg-card p-6 shadow-sm scroll-mt-6">
        <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Account</h2>
        <p className="mb-4 text-sm text-ink-muted">Your name, photo, profile, password, and a copy of your data.</p>

        <AvatarUpload name={user.name} initialAvatarUrl={user.avatarUrl} />

        <UpdateNameForm name={user.name} />
        <p className="mt-1 text-xs text-ink-muted">First and last name.</p>

        <div className="mt-6 border-t border-line pt-6">
          <p className="mb-3 text-sm font-medium text-ink">Username</p>
          <UsernameForm current={user.username} cooldownDaysLeft={usernameCooldownDaysLeft} />
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <p className="mb-3 text-sm font-medium text-ink">Profile</p>
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

        <div className="mt-6 border-t border-line pt-6">
          <p className="mb-3 text-sm font-medium text-ink">Password</p>
          <PasswordForm />
        </div>

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

        <div className="mt-6 border-t border-line pt-6">
          <p className="mb-2 text-sm font-medium text-ink">Delete account</p>
          <DeleteAccountForm />
        </div>
      </section>

      <div className="rounded-2xl border border-line bg-card p-5">
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
          <FlameIcon className="h-3.5 w-3.5 text-accent" />
          {totalEntries} journal {totalEntries === 1 ? "entry" : "entries"} written in total
        </p>
        <p className="mt-2 text-xs">
          <Link href={`/?week=${shiftISO(today, -7)}#recap`} className="text-accent hover:underline">
            Browse past weekly recaps →
          </Link>
        </p>
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

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <MoonIcon className="h-4 w-4 text-ink-muted" />
          Appearance
        </h2>
        <p className="mb-4 text-sm text-ink-muted">Light or dark — no other color options, that&apos;s the whole picker.</p>
        <DarkModeSwitch />
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <BellIcon className="h-4 w-4 text-accent" />
          Notifications
        </h2>
        <p className="mb-4 text-sm text-ink-muted">Reminders for individual goals, sent as a browser push.</p>
        <NotificationsForm />
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <ClockIcon className="h-4 w-4 text-study" />
          Study subjects
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          Rename or archive the ones you have — archiving keeps its history but takes it off the
          picker on the Study page.
        </p>

        {active.length === 0 && archived.length === 0 && (
          <p className="mb-4 text-sm text-ink-muted">No subjects yet.</p>
        )}

        <ul className="mb-4 space-y-2">
          {active.map((subject) => (
            <li key={subject.id} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
              <RenameSubjectForm subjectId={subject.id} name={subject.name} />
              <form action={setSubjectActive.bind(null, subject.id, false)}>
                <button type="submit" className="text-sm text-ink-muted hover:text-accent">
                  Archive
                </button>
              </form>
              <DeleteSubjectButton subjectId={subject.id} name={subject.name} minutes={minutesBySubject.get(subject.id) ?? 0} />
            </li>
          ))}
        </ul>

        <NewSubjectForm />

        {archived.length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <p className="mb-2 text-xs font-medium text-ink-muted">Archived</p>
            <ul className="space-y-1.5">
              {archived.map((subject) => (
                <li key={subject.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">{subject.name}</span>
                  <div className="flex items-center gap-3">
                    <form action={setSubjectActive.bind(null, subject.id, true)}>
                      <button type="submit" className="text-ink-muted hover:text-accent">
                        Reactivate
                      </button>
                    </form>
                    <DeleteSubjectButton subjectId={subject.id} name={subject.name} minutes={minutesBySubject.get(subject.id) ?? 0} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <DumbbellIcon className="h-4 w-4 text-workout" />
          Workout units
        </h2>
        <p className="mb-4 text-sm text-ink-muted">What weight and distance are shown in on the Workout page.</p>
        <UnitsForm weightUnit={user.weightUnit} distanceUnit={user.distanceUnit} />
      </section>

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
            Bugs, ideas, things that annoy you — this goes straight to Oliver, not an app store review.
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
    </div>
  );
}
