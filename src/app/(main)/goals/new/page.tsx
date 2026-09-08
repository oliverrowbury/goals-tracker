import Link from "next/link";
import { createGoal } from "../actions";
import { GoalForm } from "../GoalForm";

export default function NewGoalPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/goals" className="text-sm text-ink-muted hover:text-accent">
          ← Back to goals
        </Link>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-ink">New goal</h1>
      </div>
      <GoalForm action={createGoal} submitLabel="Create goal" />
    </div>
  );
}
