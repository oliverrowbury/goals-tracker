"use client";

// Save-on-blur caption box for the post-finish summary screens — same
// "no separate submit button" convention as VisibilityPicker on those same
// screens, since this is one more "choice" being made in that same moment.
// Controlled (value/onChange owned by the parent) rather than managing its
// own state, so the summary screen can see the live value to require a
// caption before sharing with friends (see WorkoutSummary/StudySummary).
export function CaptionField({
  value,
  onChange,
  onSave,
  focusClassName = "focus:border-accent",
  error,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  focusClassName?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onSave(value)}
        rows={2}
        maxLength={280}
        placeholder="Add a caption…"
        className={`w-full resize-none rounded-lg border bg-paper px-3 py-2 text-left text-sm text-ink placeholder:text-ink-muted focus:outline-none ${
          error ? "border-accent" : "border-line"
        } ${focusClassName}`}
      />
      {error ? <p className="mt-1 text-xs text-accent-strong">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
