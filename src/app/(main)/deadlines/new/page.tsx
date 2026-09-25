import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { createDeadline } from "../actions";
import { DeadlineForm } from "../DeadlineForm";

export const metadata = { title: "New deadline" };
export const dynamic = "force-dynamic";

export default async function NewDeadlinePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const user = await getCurrentUser();
  const subjects = await prisma.subject.findMany({ where: { userId: user.id, active: true }, orderBy: { name: "asc" } });

  return (
    <div>
      <div className="mb-6">
        <Link href="/deadlines" className="text-sm text-ink-muted hover:text-accent">
          ← Back to deadlines
        </Link>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-ink">New deadline</h1>
      </div>
      {/* Arriving from a tap on a calendar day (see calendar/page.tsx) —
          prefills that day rather than defaulting to today. */}
      <DeadlineForm
        action={createDeadline}
        submitLabel="Add deadline"
        subjects={subjects}
        initialValues={date ? { dueDate: date } : undefined}
      />
    </div>
  );
}
