"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { GENDERS, GENDER_LABELS } from "@/lib/constants";
import { completeProfile } from "./actions";

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Saving…" : "Continue"}
    </button>
  );
}

export function OnboardingForm({
  weightUnit,
  distanceUnit,
}: {
  weightUnit: "KG" | "LB";
  distanceUnit: "KM" | "MI";
}) {
  const [state, formAction] = useActionState(completeProfile, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">{state.error}</p>}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="birthday">
          Birthday
        </label>
        <input id="birthday" name="birthday" type="date" required max={new Date().toISOString().slice(0, 10)} className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="gender">
          Gender
        </label>
        <select id="gender" name="gender" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Choose one
          </option>
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {GENDER_LABELS[g]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="city">
          City
        </label>
        <input id="city" name="city" type="text" required autoComplete="address-level2" className={inputClass} />
      </div>

      <div className="border-t border-line pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">Optional</p>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pronouns">
            Pronouns
          </label>
          <input id="pronouns" name="pronouns" type="text" placeholder="she/her, he/him, they/them…" className={inputClass} />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="bio">
            Bio
          </label>
          <textarea id="bio" name="bio" rows={2} maxLength={160} placeholder="A line about you" className={`${inputClass} resize-none`} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="weight">
              Weight ({weightUnit === "LB" ? "lb" : "kg"})
            </label>
            <input id="weight" name="weight" type="number" min="0" step="0.1" className={inputClass} />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="height">
              Height ({distanceUnit === "MI" ? "in" : "cm"})
            </label>
            <input id="height" name="height" type="number" min="0" step="0.1" className={inputClass} />
          </div>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
