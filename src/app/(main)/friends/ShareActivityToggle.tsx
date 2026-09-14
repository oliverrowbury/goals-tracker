"use client";

import { useState, useTransition } from "react";
import { setShareActivity } from "./actions";

export function ShareActivityToggle({ initial }: { initial: boolean }) {
  const [shared, setShared] = useState(initial);
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={shared}
        disabled={isPending}
        onChange={() => {
          const next = !shared;
          setShared(next); // optimistic
          startTransition(() => setShareActivity(next));
        }}
        className="h-4 w-4 rounded border-line accent-calm"
      />
      Share my streaks and level with friends
    </label>
  );
}
