"use client";

import { useDarkMode } from "@/lib/useDarkMode";

export function DarkModeSwitch() {
  const { isDark, setDark } = useDarkMode();

  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-ink">Dark mode</span>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        onClick={() => setDark(!isDark)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isDark ? "bg-accent" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            isDark ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
