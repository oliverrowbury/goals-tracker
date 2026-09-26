import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, isoToDate, shiftISO, formatLong, monthISOOf, isFutureISO } from "@/lib/dates";
import { formatMinutes } from "@/lib/study";
import { formatDistance, formatPace, formatWeight, computeVolume } from "@/lib/workout";
import { moodFace } from "@/lib/mood";
import { JournalIcon, ClockIcon, DumbbellIcon, TargetIcon, AlarmIcon, ActivityIcon } from "@/components/Icons";
import { PageHeader } from "@/components/PageHeader";
import { NavPill } from "@/components/NavPill";
import { EmptyState } from "@/components/EmptyState";

// A read-only "what happened this day" summary — what tapping a past day
// on the calendar opens into, instead of dropping straight into the
// Journal editor. Journal is one section among several here (goals,
// workouts, study, deadlines all get equal billing), with its own "Edit
// journal entry" link out to the real editor for anyone who wants to
// actually write or change something.
export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return { title: formatLong(date) };
}

export default async function CalendarDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date: dateISO } = await params;
  const today = todayISO();
  if (isFutureISO(dateISO)) redirect("/calendar");

  const date = isoToDate(dateISO);
  if (Number.isNaN(date.getTime())) notFound();
  const rangeEnd = new Date(`${dateISO}T23:59:59.999Z`);

  const user = await getCurrentUser();

  const [entry, workouts, studySessions, goalLogs, deadlines] = await Promise.all([
    prisma.journalEntry.findUnique({ where: { userId_date: { userId: user.id, date } } }),
    prisma.workout.findMany({
      where: { userId: user.id, endedAt: { not: null }, date: { gte: date, lte: rangeEnd } },
      include: { sets: true },
    }),
    prisma.studySession.findMany({
      where: { userId: user.id, endedAt: { not: null }, startedAt: { gte: date, lte: rangeEnd } },
      include: { subject: true },
    }),
    prisma.goalLog.findMany({
      where: { date: { gte: date, lte: rangeEnd }, goal: { userId: user.id }, OR: [{ completed: true }, { value: { gt: 0 } }] },
      include: { goal: true },
    }),
    prisma.deadline.findMany({
      where: { userId: user.id, completed: true, dueDate: { gte: date, lte: rangeEnd } },
    }),
  ]);

  const hasAnything =
    !!entry?.mood ||
    !!entry?.bodyText.trim() ||
    !!entry?.photoUrl ||
    workouts.length > 0 ||
    studySessions.length > 0 ||
    goalLogs.length > 0 ||
    deadlines.length > 0;

  const prevISO = shiftISO(dateISO, -1);
  const nextISO = shiftISO(dateISO, 1);
  const isToday = dateISO === today;

  return (
    <div>
      <PageHeader
        icon={JournalIcon}
        title={formatLong(dateISO)}
        subtitle={isToday && <p className="text-sm text-accent">Today</p>}
        align="baseline"
        className="mb-8"
        right={
          <div className="flex items-center gap-2">
            <NavPill href={`/calendar?month=${monthISOOf(dateISO)}`}>← Calendar</NavPill>
            <NavPill href={`/calendar/${prevISO}`}>← Prev</NavPill>
            {!isFutureISO(nextISO) && <NavPill href={`/calendar/${nextISO}`}>Next →</NavPill>}
          </div>
        }
      />

      {!hasAnything && (
        <EmptyState icon={JournalIcon} message="Nothing logged this day." />
      )}

      {entry?.mood != null && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-card p-5 shadow-sm">
          <span className="text-3xl leading-none">{moodFace(entry.mood)}</span>
          <div>
            <p className="text-sm font-medium text-ink-muted">Mood</p>
            <p className="font-serif text-lg font-semibold text-ink">{entry.mood} / 5</p>
          </div>
        </div>
      )}

      {(entry?.bodyText.trim() || entry?.photoUrl) && (
        <div className="mb-6 rounded-2xl border border-line bg-card p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink-muted">Journal</h2>
            <Link href={`/journal?date=${dateISO}`} className="text-xs font-medium text-accent hover:underline">
              Edit →
            </Link>
          </div>
          {entry?.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local asset next/image can optimize
            <img src={entry.photoUrl} alt="" className="mb-3 max-h-72 w-full rounded-xl object-cover" />
          )}
          {entry?.bodyText.trim() && <p className="whitespace-pre-wrap text-sm text-ink">{entry.bodyText}</p>}
        </div>
      )}

      {goalLogs.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Goals</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {goalLogs.map((log) => (
              <li key={log.id} className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink">
                <TargetIcon className="h-4 w-4 shrink-0 text-goals" />
                <span className="flex-1">{log.goal.title}</span>
                {log.goal.frequencyType === "WEEKLY_TARGET" ? (
                  <span className="text-ink-muted">
                    {log.value} {log.goal.unit}
                  </span>
                ) : (
                  <span className="text-goals">Done</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {studySessions.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Studied</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {studySessions.map((session) => (
              <li key={session.id} className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-ink">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: session.subject.color }} />
                {session.subject.name}
                <span className="text-ink-muted">— {formatMinutes(session.durationMinutes ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {workouts.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Workouts</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {workouts.map((w) => {
              const isCardio = w.type === "CARDIO";
              return (
                <li key={w.id} className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isCardio ? "bg-workout-soft text-workout" : "bg-line text-ink"
                    }`}
                  >
                    {isCardio ? <ActivityIcon className="h-3.5 w-3.5" /> : <DumbbellIcon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1">{w.label}</span>
                  <span className="text-ink-muted">
                    {isCardio ? (
                      <>
                        {w.distanceKm ? `${formatDistance(w.distanceKm, user.distanceUnit)} · ` : ""}
                        {formatMinutes(w.durationMinutes ?? 0)}
                        {formatPace(w.distanceKm, w.durationMinutes, user.distanceUnit)
                          ? ` · ${formatPace(w.distanceKm, w.durationMinutes, user.distanceUnit)}`
                          : ""}
                      </>
                    ) : (
                      <>
                        {formatMinutes(w.durationMinutes ?? 0)}
                        {computeVolume(w.sets) > 0 ? ` · ${formatWeight(computeVolume(w.sets), user.weightUnit)}` : ""}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {deadlines.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Deadlines completed</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {deadlines.map((d) => (
              <li key={d.id} className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink">
                <AlarmIcon className="h-4 w-4 shrink-0 text-accent" />
                <span className="flex-1">{d.title}</span>
                <span className="text-accent">Done</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!entry?.mood && !entry?.bodyText.trim() && !entry?.photoUrl && (
        <p className="mt-2 text-xs text-ink-muted">
          <ClockIcon className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          No journal entry for this day —{" "}
          <Link href={`/journal?date=${dateISO}`} className="text-accent hover:underline">
            write one
          </Link>
          .
        </p>
      )}
    </div>
  );
}
