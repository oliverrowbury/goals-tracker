import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, dateToISO, daysBetween, formatLong } from "@/lib/dates";
import { AlarmIcon } from "@/components/Icons";
import { DeadlineCheckbox } from "./DeadlineCheckbox";
import { DeleteDeadlineButton } from "./DeleteDeadlineButton";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const metadata = { title: "Deadlines" };
export const dynamic = "force-dynamic";

function countdownLabel(dueISO: string, today: string): { text: string; urgent: boolean } {
  const days = daysBetween(today, dueISO);
  if (days < 0) return { text: `${-days} day${-days === 1 ? "" : "s"} overdue`, urgent: true };
  if (days === 0) return { text: "Due today", urgent: true };
  if (days === 1) return { text: "Due tomorrow", urgent: true };
  if (days <= 3) return { text: `Due in ${days} days`, urgent: true };
  return { text: `Due in ${days} days`, urgent: false };
}

export default async function DeadlinesPage() {
  const user = await getCurrentUser();
  const today = todayISO();

  const deadlines = await prisma.deadline.findMany({
    where: { userId: user.id },
    orderBy: { dueDate: "asc" },
    include: { subject: { select: { name: true, color: true } } },
  });

  const upcoming = deadlines.filter((d) => !d.completed);
  const completed = deadlines.filter((d) => d.completed).sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());

  return (
    <div>
      <PageHeader
        icon={AlarmIcon}
        title="Deadlines"
        right={
          <Link
            href="/deadlines/new"
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 hover:shadow-md active:scale-[0.98]"
          >
            New deadline
          </Link>
        }
      />

      {upcoming.length === 0 && (
        <EmptyState icon={AlarmIcon} message="No deadlines yet — add an exam or assignment to track it." />
      )}

      <div className="space-y-2.5">
        {upcoming.map((deadline) => {
          const dueISO = dateToISO(deadline.dueDate);
          const { text, urgent } = countdownLabel(dueISO, today);
          return (
            <div key={deadline.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  <DeadlineCheckbox deadlineId={deadline.id} initialCompleted={deadline.completed} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-ink">{deadline.title}</h2>
                    {deadline.subject && (
                      <span className="flex items-center gap-1 rounded-full bg-line/50 px-2 py-0.5 text-xs text-ink-muted">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: deadline.subject.color }} />
                        {deadline.subject.name}
                      </span>
                    )}
                  </div>
                  <p className={`mt-0.5 text-sm ${urgent ? "font-medium text-accent" : "text-ink-muted"}`}>
                    {formatLong(dueISO)}
                    {deadline.dueTime !== "23:59" && ` at ${deadline.dueTime}`} · {text}
                  </p>
                  {deadline.notes && <p className="mt-1.5 text-sm text-ink-muted">{deadline.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <Link href={`/deadlines/${deadline.id}/edit`} className="text-ink-muted hover:text-accent">
                    Edit
                  </Link>
                  <DeleteDeadlineButton deadlineId={deadline.id} title={deadline.title} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {completed.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-ink-muted">Completed</h2>
          <div className="divide-y divide-line rounded-2xl border border-line bg-card">
            {completed.map((deadline) => (
              <div key={deadline.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <DeadlineCheckbox deadlineId={deadline.id} initialCompleted={deadline.completed} />
                <span className="flex-1 text-ink-muted line-through">{deadline.title}</span>
                <DeleteDeadlineButton deadlineId={deadline.id} title={deadline.title} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
