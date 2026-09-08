import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateGoal } from "../../actions";
import { GoalForm } from "../../GoalForm";

export default async function EditGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) notFound();

  const updateGoalWithId = updateGoal.bind(null, goal.id);

  return (
    <div>
      <div className="mb-6">
        <Link href="/goals" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Back to goals
        </Link>
        <h1 className="mt-1 text-lg font-semibold">Edit goal</h1>
      </div>
      <GoalForm
        action={updateGoalWithId}
        submitLabel="Save changes"
        initialValues={{
          title: goal.title,
          description: goal.description ?? "",
          frequencyType: goal.frequencyType,
          targetDays: goal.targetDays,
          targetValue: goal.targetValue?.toString() ?? "",
          unit: goal.unit ?? "",
        }}
      />
    </div>
  );
}
