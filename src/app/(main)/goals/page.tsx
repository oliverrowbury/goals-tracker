import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, shiftISO } from "@/lib/dates";
import { computeStreak, describeFrequency, isGoalDueOn, weekRangeContaining } from "@/lib/goals";
import { setGoalActive } from "./actions";
import { TargetIcon, FlameIcon } from "@/components/Icons";

const HISTORY_DAYS = 14;

// Without this, Next.js has no reason to think this page depends on
// per-request state (no searchParams/cookies here) and would prerender it
// once at build time — freezing whatever goals existed at deploy time
// instead of showing live data on every visit.
export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const user = await getCurrentUser();
  const today = todayISO();
  const { startISO: weekStartISO, endISO: weekEndISO } = weekRangeContaining(today);

  const [goals, weekStudySessions] = await Promise.all([
    prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: { logs: true },
    }),
    prisma.studySession.findMany({
      where: {
        userId: user.id,
        endedAt: { not: null },
        startedAt: { gte: new Date(`${weekStartISO}T00:00:00.000Z`), lte: new Date(`${weekEndISO}T23:59:59.999Z`) },
      },
    }),
  ]);

  const weekMinutesBySubject = new Map<string, number>();
  for (const session of weekStudySessions) {
    weekMinutesBySubject.set(
      session.subjectId,
      (weekMinutesBySubject.get(session.subjectId) ?? 0) + (session.durationMinutes ?? 0),
    );
  }

  const active = goals.filter((g) => g.active);
  const archived = goals.filter((g) => !g.active);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <TargetIcon className="h-5 w-5 shrink-0 text-goals" />
          <h1 className="font-serif text-2xl font-semibold text-ink">Goals</h1>
        </div>
        <Link
          href="/goals/new"
          className="rounded-lg bg-goals px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          New goal
        </Link>
      </div>

      {active.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-goals-soft text-goals">
            <TargetIcon className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm text-ink-muted">No goals yet — add one to start tracking.</p>
        </div>
      )}

      <div className="space-y-3">
        {active.map((goal) => {
          const completedDates = new Set(
            goal.logs.filter((l) => l.completed).map((l) => l.date.toISOString().slice(0, 10)),
          );
          const streak = goal.frequencyType !== "WEEKLY_TARGET" ? computeStreak(goal, completedDates, today) : null;

          const weekTotal =
            goal.frequencyType === "WEEKLY_TARGET"
              ? goal.subjectId
                ? (weekMinutesBySubject.get(goal.subjectId) ?? 0)
                : goal.logs
                    .filter((l) => {
                      const d = l.date.toISOString().slice(0, 10);
                      return d >= weekStartISO && d <= weekEndISO;
                    })
                    .reduce((sum, l) => sum + (l.value ?? 0), 0)
              : null;

          const historyDays = Array.from({ length: HISTORY_DAYS }, (_, i) => shiftISO(today, -(HISTORY_DAYS - 1 - i)));

          return (
            <div key={goal.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium text-ink">{goal.title}</h2>
                  <p className="text-sm text-ink-muted">{describeFrequency(goal)}</p>
                  {goal.description && <p className="mt-1 text-sm text-ink-muted">{goal.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  {streak !== null && streak > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-goals-soft px-2.5 py-1 font-medium text-goals">
                      <FlameIcon className="h-3.5 w-3.5" />
                      {streak} day{streak === 1 ? "" : "s"}
                    </span>
                  )}
                  <Link href={`/goals/${goal.id}/edit`} className="text-ink-muted hover:text-goals">
                    Edit
                  </Link>
                  <form action={setGoalActive.bind(null, goal.id, false)}>
                    <button type="submit" className="text-ink-muted hover:text-goals">
                      Archive
                    </button>
                  </form>
                </div>
              </div>

              {goal.frequencyType === "WEEKLY_TARGET" && weekTotal !== null && (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/50">
                    <div
                      className="h-full rounded-full bg-goals"
                      style={{ width: `${Math.min(100, ((weekTotal / (goal.targetValue || 1)) * 100))}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-ink-muted">
                    {weekTotal}/{goal.targetValue} {goal.unit} this week
                    {goal.subjectId && " · auto-tracked from Study"}
                  </p>
                </div>
              )}

              {goal.frequencyType !== "WEEKLY_TARGET" && (
                <div className="mt-3 flex gap-1">
                  {historyDays.map((day) => {
                    const due = isGoalDueOn(goal, day);
                    const done = completedDates.has(day);
                    return (
                      <div
                        key={day}
                        title={day}
                        className={`h-4 w-4 rounded-sm ${
                          !due
                            ? "bg-line/40"
                            : done
                              ? "bg-goals"
                              : day < today
                                ? "bg-goals-soft"
                                : "border border-dashed border-line"
                        }`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {archived.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-ink-muted">Archived</h2>
          <div className="space-y-2">
            {archived.map((goal) => (
              <div
                key={goal.id}
                className="flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-2.5 text-sm"
              >
                <span className="text-ink-muted">{goal.title}</span>
                <form action={setGoalActive.bind(null, goal.id, true)}>
                  <button type="submit" className="text-ink-muted hover:text-goals">
                    Reactivate
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
