import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateDeadline } from "../../actions";
import { DeadlineForm } from "../../DeadlineForm";
import { dateToISO } from "@/lib/dates";

export default async function EditDeadlinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deadline = await prisma.deadline.findUnique({ where: { id } });
  if (!deadline) notFound();

  // Same reasoning as the goal-edit page — keep the already-linked subject
  // selectable even if it's since been archived, so editing doesn't
  // silently drop the link.
  const subjects = await prisma.subject.findMany({
    where: {
      userId: deadline.userId,
      OR: deadline.subjectId ? [{ active: true }, { id: deadline.subjectId }] : [{ active: true }],
    },
    orderBy: { name: "asc" },
  });
  const updateDeadlineWithId = updateDeadline.bind(null, deadline.id);

  return (
    <div>
      <div className="mb-6">
        <Link href="/deadlines" className="text-sm text-ink-muted hover:text-accent">
          ← Back to deadlines
        </Link>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-ink">Edit deadline</h1>
      </div>
      <DeadlineForm
        action={updateDeadlineWithId}
        submitLabel="Save changes"
        subjects={subjects}
        initialValues={{
          title: deadline.title,
          dueDate: dateToISO(deadline.dueDate),
          subjectId: deadline.subjectId ?? "",
          notes: deadline.notes ?? "",
        }}
      />
    </div>
  );
}
