"use client";

import { useActionState } from "react";
import { updateUnits } from "./actions";

export function UnitsForm({ weightUnit, distanceUnit }: { weightUnit: "KG" | "LB"; distanceUnit: "KM" | "MI" }) {
  const [state, formAction, isPending] = useActionState(updateUnits, null);

  // The server action's own return value is the source of truth once it
  // resolves — reading it back from the surrounding page's props can lag
  // behind what was just saved, which showed up as the dropdowns silently
  // snapping back to their old value right after "Save". Keying each
  // select on the confirmed value forces a clean remount exactly when it
  // changes, instead of relying on an in-place update to a `<select>` to
  // pick up a new `defaultValue` — that update path proved unreliable here.
  const currentWeight = state?.weightUnit ?? weightUnit;
  const currentDistance = state?.distanceUnit ?? distanceUnit;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <div>
        <label className="mb-1 block text-xs text-ink-muted" htmlFor="weightUnit">
          Weight
        </label>
        <select
          key={currentWeight}
          id="weightUnit"
          name="weightUnit"
          defaultValue={currentWeight}
          className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm focus:border-workout focus:outline-none"
        >
          <option value="KG">Kilograms (kg)</option>
          <option value="LB">Pounds (lb)</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted" htmlFor="distanceUnit">
          Distance
        </label>
        <select
          key={currentDistance}
          id="distanceUnit"
          name="distanceUnit"
          defaultValue={currentDistance}
          className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm focus:border-workout focus:outline-none"
        >
          <option value="KM">Kilometres (km)</option>
          <option value="MI">Miles (mi)</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-workout px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
