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
  subjectId: string;
};

const DEFAULTS: GoalFormValues = {
  title: "",
  description: "",
  frequencyType: "DAILY",
  targetDays: [],
  targetValue: "",
  unit: "",
  subjectId: "",
};

const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:border-goals focus:outline-none";
const labelClass = "mb-1 block text-sm font-medium text-ink";

export function GoalForm({
  action,
  initialValues,
  submitLabel,
  subjects = [],
}: {
  action: (formData: FormData) => void;
  initialValues?: Partial<GoalFormValues>;
  submitLabel: string;
  subjects?: { id: string; name: string }[];
}) {
  const values = { ...DEFAULTS, ...initialValues };
  const [frequencyType, setFrequencyType] = useState(values.frequencyType);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <div>
        <label className={labelClass} htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          defaultValue={values.title}
          required
          placeholder="e.g. Gym 3x a week"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="description">
          Description <span className="text-ink-muted">(optional)</span>
        </label>
        <textarea id="description" name="description" defaultValue={values.description} rows={2} className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="frequencyType">
          Frequency
        </label>
        <select
          id="frequencyType"
          name="frequencyType"
          value={frequencyType}
          onChange={(e) => setFrequencyType(e.target.value)}
          className={inputClass}
        >
          <option value="DAILY">Every day</option>
          <option value="SPECIFIC_DAYS">Specific days of the week</option>
          <option value="WEEKLY_TARGET">A weekly total (e.g. hours/sessions)</option>
        </select>
      </div>

      {frequencyType === "SPECIFIC_DAYS" && (
        <div>
          <span className={labelClass}>Which days?</span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day}
                className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm text-ink has-[:checked]:border-goals has-[:checked]:bg-goals has-[:checked]:text-white"
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
            <label className={labelClass} htmlFor="targetValue">
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
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label className={labelClass} htmlFor="unit">
              Unit
            </label>
            <input
              id="unit"
              name="unit"
              defaultValue={values.unit}
              placeholder="minutes, sessions, pages…"
              required
              className={inputClass}
            />
          </div>
        </div>
      )}

      {frequencyType === "WEEKLY_TARGET" && subjects.length > 0 && (
        <div>
          <label className={labelClass} htmlFor="subjectId">
            Auto-track from a study subject <span className="text-ink-muted">(optional)</span>
          </label>
          <select id="subjectId" name="subjectId" defaultValue={values.subjectId} className={inputClass}>
            <option value="">No — I'll log this myself</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">
            When set, this goal's weekly total comes straight from time logged on the Study page instead of manual entry.
          </p>
        </div>
      )}

      <button type="submit" className="rounded-lg bg-goals px-4 py-2 text-sm font-medium text-white hover:opacity-90">
        {submitLabel}
      </button>
    </form>
  );
}
