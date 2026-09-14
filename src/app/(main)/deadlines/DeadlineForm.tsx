"use client";

import { useFormStatus } from "react-dom";
import { todayISO } from "@/lib/dates";

type DeadlineFormValues = {
  title: string;
  dueDate: string;
  dueTime: string;
  subjectId: string;
  notes: string;
};

const DEFAULTS: DeadlineFormValues = {
  title: "",
  dueDate: todayISO(),
  dueTime: "23:59",
  subjectId: "",
  notes: "",
};

// Same reasoning as GoalForm's SubmitButton — without a pending-disabled
// state, a slow save (or an impatient extra tap) could submit twice.
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const labelClass = "mb-1 block text-sm font-medium text-ink";

export function DeadlineForm({
  action,
  initialValues,
  submitLabel,
  subjects = [],
}: {
  action: (formData: FormData) => void;
  initialValues?: Partial<DeadlineFormValues>;
  submitLabel: string;
  subjects?: { id: string; name: string }[];
}) {
  const values = { ...DEFAULTS, ...initialValues };

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
          placeholder="e.g. Physics coursework"
          className={inputClass}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass} htmlFor="dueDate">
            Due date
          </label>
          <input id="dueDate" name="dueDate" type="date" defaultValue={values.dueDate} required className={inputClass} />
        </div>
        <div className="flex-1">
          <label className={labelClass} htmlFor="dueTime">
            Due time <span className="text-ink-muted">(optional)</span>
          </label>
          <input id="dueTime" name="dueTime" type="time" defaultValue={values.dueTime} className={inputClass} />
        </div>
      </div>

      {subjects.length > 0 && (
        <div>
          <label className={labelClass} htmlFor="subjectId">
            Subject <span className="text-ink-muted">(optional)</span>
          </label>
          <select id="subjectId" name="subjectId" defaultValue={values.subjectId} className={inputClass}>
            <option value="">None</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass} htmlFor="notes">
          Notes <span className="text-ink-muted">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={values.notes}
          rows={3}
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          className={inputClass}
        />
      </div>

      <SubmitButton label={submitLabel} />
    </form>
  );
}
