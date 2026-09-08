"use client";

import { useState } from "react";
import { WEEKDAYS } from "@/lib/constants";

type GoalFormValues = {
  title: string;
  description: string;
  frequencyType: string;
  targetDays: string[];
  targetValue: string;
  unit: string;
};

const DEFAULTS: GoalFormValues = {
  title: "",
  description: "",
  frequencyType: "DAILY",
  targetDays: [],
  targetValue: "",
  unit: "",
};

export function GoalForm({
  action,
  initialValues,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  initialValues?: Partial<GoalFormValues>;
  submitLabel: string;
}) {
  const values = { ...DEFAULTS, ...initialValues };
  const [frequencyType, setFrequencyType] = useState(values.frequencyType);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          defaultValue={values.title}
          required
          placeholder="e.g. Gym 3x a week"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700" htmlFor="description">
          Description <span className="text-neutral-400">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={values.description}
          rows={2}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700" htmlFor="frequencyType">
          Frequency
        </label>
        <select
          id="frequencyType"
          name="frequencyType"
          value={frequencyType}
          onChange={(e) => setFrequencyType(e.target.value)}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        >
          <option value="DAILY">Every day</option>
          <option value="SPECIFIC_DAYS">Specific days of the week</option>
          <option value="WEEKLY_TARGET">A weekly total (e.g. hours/sessions)</option>
        </select>
      </div>

      {frequencyType === "SPECIFIC_DAYS" && (
        <div>
          <span className="mb-1 block text-sm font-medium text-neutral-700">Which days?</span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day}
                className="flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white"
              >
                <input
                  type="checkbox"
                  name="targetDays"
                  value={day}
                  defaultChecked={values.targetDays.includes(day)}
                  className="sr-only"
                />
                {day}
              </label>
            ))}
          </div>
        </div>
      )}

      {frequencyType === "WEEKLY_TARGET" && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-neutral-700" htmlFor="targetValue">
              Target amount
            </label>
            <input
              id="targetValue"
              name="targetValue"
              type="number"
              min="0"
              step="any"
              defaultValue={values.targetValue}
              required
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-neutral-700" htmlFor="unit">
              Unit
            </label>
            <input
              id="unit"
              name="unit"
              defaultValue={values.unit}
              placeholder="minutes, sessions, pages…"
              required
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        {submitLabel}
      </button>
    </form>
  );
}
