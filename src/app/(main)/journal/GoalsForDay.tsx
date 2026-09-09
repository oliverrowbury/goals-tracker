"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleGoalCompletion, setGoalLogValue } from "../goals/actions";
import { TargetIcon } from "@/components/Icons";

export type DayGoal = {
  id: string;
  title: string;
  frequencyType: string;
  unit: string | null;
  targetValue: number | null;
  completed: boolean;
  value: number | null;
  weekTotal: number | null;
  isAutoTracked: boolean;
};

function GoalCheckboxRow({ goal, dateISO }: { goal: DayGoal; dateISO: string }) {
  const [completed, setCompleted] = useState(goal.completed);
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex flex-1 items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={completed}
        disabled={isPending}
        onChange={() => {
          const next = !completed;
          setCompleted(next); // optimistic — don't wait on the round trip to reflect the click
          startTransition(() => {
            toggleGoalCompletion(goal.id, dateISO);
          });
        }}
        className="h-4 w-4 rounded border-line accent-goals"
      />
      <span className={completed ? "text-ink-muted line-through" : "text-ink"}>{goal.title}</span>
    </label>
  );
}

function WeeklyTargetRow({ goal, dateISO }: { goal: DayGoal; dateISO: string }) {
  const [value, setValue] = useState(goal.value ?? 0);
  const [weekTotal, setWeekTotal] = useState(goal.weekTotal ?? 0);
  const [isPending, startTransition] = useTransition();

  if (goal.isAutoTracked) {
    return (
      <>
        <span className="text-sm text-ink">{goal.title}</span>
        <span className="text-xs text-ink-muted">
          <span className="font-medium text-goals">{weekTotal}</span>/{goal.targetValue} {goal.unit} this week ·
          auto-tracked
        </span>
      </>
    );
  }

  return (
    <>
      <span className="text-sm text-ink">{goal.title}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="any"
          disabled={isPending}
          defaultValue={goal.value ?? ""}
          placeholder="0"
          onBlur={(e) => {
            const newValue = Number(e.target.value || 0);
            const delta = newValue - value;
            setValue(newValue);
            setWeekTotal((t) => t + delta); // optimistic weekly total
            startTransition(() => {
              setGoalLogValue(goal.id, dateISO, newValue);
            });
          }}
          className="w-16 rounded-md border border-line px-2 py-1 text-right text-sm focus:border-goals focus:outline-none"
        />
        <span className="text-xs text-ink-muted">
          {goal.unit} today · <span className="font-medium text-goals">{weekTotal}</span>/{goal.targetValue} this week
        </span>
      </div>
    </>
  );
}

export function GoalsForDay({ dateISO, goals }: { dateISO: string; goals: DayGoal[] }) {
  if (goals.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3.5 py-3 text-sm text-ink-muted">
        <TargetIcon className="h-4 w-4 shrink-0 text-goals" />
        No goals due today.{" "}
        <Link href="/goals" className="text-goals underline hover:opacity-80">
          Add one
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {goals.map((goal) => (
        <li
          key={`${dateISO}-${goal.id}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-3.5 py-2.5"
        >
          {goal.frequencyType === "WEEKLY_TARGET" ? (
            <WeeklyTargetRow goal={goal} dateISO={dateISO} />
          ) : (
            <GoalCheckboxRow goal={goal} dateISO={dateISO} />
          )}
        </li>
      ))}
    </ul>
  );
}
