"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { WEEKDAYS, REMINDER_SLOTS, REMINDER_SLOT_LABELS } from "@/lib/constants";

type GoalFormValues = {
  title: string;
  description: string;
  frequencyType: string;
  targetDays: string[];
  targetValue: string;
  unit: string;
  subjectId: string;
  workoutMetric: string;
  reminderEnabled: boolean;
  reminderDays: string[];
  reminderSlots: string[];
};

const DEFAULTS: GoalFormValues = {
  title: "",
  description: "",
  frequencyType: "DAILY",
  targetDays: [],
  targetValue: "",
  unit: "",
  subjectId: "",
  workoutMetric: "",
  reminderEnabled: false,
  reminderDays: [],
  reminderSlots: [],
};

// useFormStatus only reports the status of the nearest enclosing <form>, so
// this has to be its own component rendered inside it — reading it in
// GoalForm itself would always see `pending: false`. Without this, nothing
// stopped a slow save (or an impatient extra tap) from submitting the same
// form multiple times, each one creating its own goal.
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-goals px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

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
  const [reminderEnabled, setReminderEnabled] = useState(values.reminderEnabled);

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
        <textarea
          id="description"
          name="description"
          defaultValue={values.description}
          rows={2}
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          className={inputClass}
        />
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

      {frequencyType === "WEEKLY_TARGET" && (
        <div>
          <label className={labelClass} htmlFor="autoTrack">
            Auto-track from <span className="text-ink-muted">(optional)</span>
          </label>
          <select
            id="autoTrack"
            name="autoTrack"
            defaultValue={values.subjectId ? `subject:${values.subjectId}` : values.workoutMetric ? `workout:${values.workoutMetric}` : ""}
            className={inputClass}
          >
            <option value="">No — I’ll log this myself</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={`subject:${subject.id}`}>
                {subject.name} (Study)
              </option>
            ))}
            <option value="workout:SESSIONS">Workouts logged this week (Workout)</option>
            <option value="workout:MINUTES">Workout minutes this week (Workout)</option>
          </select>
          <p className="mt-1 text-xs text-ink-muted">
            When set, this goal’s weekly total is computed automatically instead of needing manual entry.
          </p>
        </div>
      )}

      <div className="border-t border-line pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            name="reminderEnabled"
            checked={reminderEnabled}
            onChange={(e) => setReminderEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-goals"
          />
          Remind me about this goal
        </label>
        {reminderEnabled && (
          <div className="mt-3 space-y-3">
            <div>
              <span className="mb-1 block text-xs text-ink-muted">On which days?</span>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <label
                    key={day}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm text-ink has-[:checked]:border-goals has-[:checked]:bg-goals has-[:checked]:text-white"
                  >
                    <input
                      type="checkbox"
                      name="reminderDays"
                      value={day}
                      defaultChecked={values.reminderDays.includes(day)}
                      className="sr-only"
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-xs text-ink-muted">And at which times? (each sent as a separate push notification)</span>
              <div className="flex flex-wrap gap-2">
                {REMINDER_SLOTS.map((slot) => (
                  <label
                    key={slot}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm text-ink has-[:checked]:border-goals has-[:checked]:bg-goals has-[:checked]:text-white"
                  >
                    <input
                      type="checkbox"
                      name="reminderSlots"
                      value={slot}
                      defaultChecked={values.reminderSlots.includes(slot)}
                      className="sr-only"
                    />
                    {REMINDER_SLOT_LABELS[slot]}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <SubmitButton label={submitLabel} />
    </form>
  );
}
