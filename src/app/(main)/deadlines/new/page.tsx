import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { createDeadline } from "../actions";
import { DeadlineForm } from "../DeadlineForm";

export const dynamic = "force-dynamic";

export default async function NewDeadlinePage() {
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
      <DeadlineForm action={createDeadline} submitLabel="Add deadline" subjects={subjects} />
    </div>
  );
}
