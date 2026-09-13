"use client";

import { useRouter } from "next/navigation";

// history.back() when we actually got here from another page in this app
// (the common case — the "Need a moment? Breathe" link); falls back to the
// Journal page for a direct visit with no history to go back to.
export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/journal");
      }}
      className="mb-4 flex items-center gap-1.5 text-sm text-ink-muted hover:text-calm"
    >
      ← Back
    </button>
  );
}
