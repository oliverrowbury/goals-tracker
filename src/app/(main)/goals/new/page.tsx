import Link from "next/link";
import { createGoal } from "../actions";
import { GoalForm } from "../GoalForm";

export default function NewGoalPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/goals" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Back to goals
        </Link>
        <h1 className="mt-1 text-lg font-semibold">New goal</h1>
      </div>
      <GoalForm action={createGoal} submitLabel="Create goal" />
    </div>
  );
}
