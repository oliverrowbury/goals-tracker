"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleGoalCompletion, setGoalLogValue } from "../goals/actions";

export type DayGoal = {
  id: string;
  title: string;
  frequencyType: string;
  unit: string | null;
  targetValue: number | null;
  completed: boolean;
  value: number | null;
  weekTotal: number | null;
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
        className="h-4 w-4 rounded border-neutral-300"
      />
      <span className={completed ? "text-neutral-400 line-through" : ""}>{goal.title}</span>
    </label>
  );
}

function WeeklyTargetRow({ goal, dateISO }: { goal: DayGoal; dateISO: string }) {
  const [value, setValue] = useState(goal.value ?? 0);
  const [weekTotal, setWeekTotal] = useState(goal.weekTotal ?? 0);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <span className="text-sm">{goal.title}</span>
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
          className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-right text-sm"
        />
        <span className="text-xs text-neutral-500">
          {goal.unit} today · {weekTotal}/{goal.targetValue} this week
        </span>
      </div>
    </>
  );
}

export function GoalsForDay({ dateISO, goals }: { dateISO: string; goals: DayGoal[] }) {
  if (goals.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No goals due today.{" "}
        <Link href="/goals" className="underline hover:text-neutral-900">
          Add one
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {goals.map((goal) => (
        <li
          key={`${dateISO}-${goal.id}`}
          className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2"
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
