import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { createGoal } from "../actions";
import { GoalForm } from "../GoalForm";

export const dynamic = "force-dynamic";

export default async function NewGoalPage() {
  const user = await getCurrentUser();
  const subjects = await prisma.subject.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } });

  return (
    <div>
      <div className="mb-6">
        <Link href="/goals" className="text-sm text-ink-muted hover:text-accent">
          ← Back to goals
        </Link>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-ink">New goal</h1>
      </div>
      <GoalForm action={createGoal} submitLabel="Create goal" subjects={subjects} />
    </div>
  );
}
