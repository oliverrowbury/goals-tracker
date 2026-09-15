"use client";

import { useActionState } from "react";
import { GENDERS, GENDER_LABELS, type Gender } from "@/lib/constants";
import { updateProfile, type SettingsActionState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function ProfileForm({
  birthdayISO,
  gender,
  city,
  bio,
  pronouns,
  weight,
  height,
  weightUnit,
  distanceUnit,
}: {
  birthdayISO: string | null;
  gender: Gender | null;
  city: string | null;
  bio: string | null;
  pronouns: string | null;
  weight: number | null;
  height: number | null;
  weightUnit: "KG" | "LB";
  distanceUnit: "KM" | "MI";
}) {
  const [state, formAction, isPending] = useActionState<SettingsActionState, FormData>(updateProfile, null);

  return (
    <form action={formAction} className="max-w-sm space-y-3">
      {state?.error && <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">{state.error}</p>}
      {state?.success && <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">{state.success}</p>}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="birthday">
          Birthday
        </label>
        <input
          id="birthday"
          name="birthday"
          type="date"
          required
          max={new Date().toISOString().slice(0, 10)}
          defaultValue={birthdayISO ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="gender">
          Gender
        </label>
        <select id="gender" name="gender" required defaultValue={gender ?? ""} className={inputClass}>
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
        <input id="city" name="city" type="text" required defaultValue={city ?? ""} autoComplete="address-level2" className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pronouns">
          Pronouns
        </label>
        <input
          id="pronouns"
          name="pronouns"
          type="text"
          defaultValue={pronouns ?? ""}
          placeholder="she/her, he/him, they/them…"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="bio">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={2}
          maxLength={160}
          defaultValue={bio ?? ""}
          placeholder="A line about you"
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="weight">
            Weight ({weightUnit === "LB" ? "lb" : "kg"})
          </label>
          <input id="weight" name="weight" type="number" min="0" step="0.1" defaultValue={weight ?? ""} className={inputClass} />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="height">
            Height ({distanceUnit === "MI" ? "in" : "cm"})
          </label>
          <input id="height" name="height" type="number" min="0" step="0.1" defaultValue={height ?? ""} className={inputClass} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
