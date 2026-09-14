"use client";

import { useFormStatus } from "react-dom";
import { updateAccentTheme } from "./actions";
import { ACCENT_THEMES, type AccentTheme } from "@/lib/constants";

const PRESETS: Record<AccentTheme, { label: string; swatch: string }> = {
  TERRACOTTA: { label: "Terracotta", swatch: "#c1592f" },
  OCEAN: { label: "Ocean", swatch: "#2b6cb0" },
  FOREST: { label: "Forest", swatch: "#3f7d4f" },
  BERRY: { label: "Berry", swatch: "#a13d68" },
  SLATE: { label: "Slate", swatch: "#51606e" },
};

// Each swatch is its own submit button on the same form — clicking one
// submits {accentTheme: <that preset>} directly (only the clicked button's
// name/value pair goes in FormData), so picking a color is a single click
// rather than "select, then hit Save".
function Swatch({ theme, selected }: { theme: AccentTheme; selected: boolean }) {
  const { pending } = useFormStatus();
  const { label, swatch } = PRESETS[theme];
  return (
    <button
      type="submit"
      name="accentTheme"
      value={theme}
      disabled={pending}
      aria-pressed={selected}
      title={label}
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition disabled:opacity-50 ${
        selected ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-muted hover:border-accent"
      }`}
    >
      <span
        className="h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-card"
        style={{ backgroundColor: swatch, ["--tw-ring-color" as string]: selected ? swatch : "transparent" }}
      />
      {label}
    </button>
  );
}

export function AccentThemeForm({ current }: { current: AccentTheme }) {
  return (
    <form action={updateAccentTheme} className="flex flex-wrap gap-2.5">
      {ACCENT_THEMES.map((theme) => (
        <Swatch key={theme} theme={theme} selected={theme === current} />
      ))}
    </form>
  );
}
