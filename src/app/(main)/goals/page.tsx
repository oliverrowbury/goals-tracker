import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, shiftISO } from "@/lib/dates";
import { computeStreak, describeFrequency, isGoalDueOn } from "@/lib/goals";
import { setGoalActive } from "./actions";

const HISTORY_DAYS = 14;

// Without this, Next.js has no reason to think this page depends on
// per-request state (no searchParams/cookies here) and would prerender it
// once at build time — freezing whatever goals existed at deploy time
// instead of showing live data on every visit.
export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const user = await getCurrentUser();
  const goals = await prisma.goal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { logs: true },
  });

  const today = todayISO();
  const active = goals.filter((g) => g.active);
  const archived = goals.filter((g) => !g.active);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Goals</h1>
        <Link
          href="/goals/new"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          New goal
        </Link>
      </div>

      {active.length === 0 && (
        <p className="text-sm text-neutral-500">No goals yet — add one to start tracking.</p>
      )}

      <div className="space-y-3">
        {active.map((goal) => {
          const completedDates = new Set(
            goal.logs.filter((l) => l.completed).map((l) => l.date.toISOString().slice(0, 10)),
          );
          const streak = goal.frequencyType !== "WEEKLY_TARGET" ? computeStreak(goal, completedDates, today) : null;

          const historyDays = Array.from({ length: HISTORY_DAYS }, (_, i) => shiftISO(today, -(HISTORY_DAYS - 1 - i)));

          return (
            <div key={goal.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium">{goal.title}</h2>
                  <p className="text-sm text-neutral-500">{describeFrequency(goal)}</p>
                  {goal.description && <p className="mt-1 text-sm text-neutral-600">{goal.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  {streak !== null && (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700">
                      {streak} day{streak === 1 ? "" : "s"} streak
                    </span>
                  )}
                  <Link href={`/goals/${goal.id}/edit`} className="text-neutral-500 hover:text-neutral-900">
                    Edit
                  </Link>
                  <form action={setGoalActive.bind(null, goal.id, false)}>
                    <button type="submit" className="text-neutral-500 hover:text-neutral-900">
                      Archive
                    </button>
                  </form>
                </div>
              </div>

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
                            ? "bg-neutral-100"
                            : done
                              ? "bg-neutral-900"
                              : day < today
                                ? "bg-red-200"
                                : "border border-dashed border-neutral-300"
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
          <h2 className="mb-3 text-sm font-medium text-neutral-500">Archived</h2>
          <div className="space-y-2">
            {archived.map((goal) => (
              <div
                key={goal.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm"
              >
                <span className="text-neutral-500">{goal.title}</span>
                <form action={setGoalActive.bind(null, goal.id, true)}>
                  <button type="submit" className="text-neutral-500 hover:text-neutral-900">
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
