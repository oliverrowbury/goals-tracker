"use client";

import { useState } from "react";

// Save-on-blur caption box for the post-finish summary screens — same
// "no separate submit button" convention as VisibilityPicker on those same
// screens, since this is one more "choice" being made in that same moment.
export function CaptionField({
  initialValue,
  onSave,
  focusClassName = "focus:border-accent",
}: {
  initialValue: string;
  onSave: (value: string) => void;
  focusClassName?: string;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== initialValue) onSave(value);
      }}
      rows={2}
      maxLength={280}
      placeholder="Add a caption…"
      className={`w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-left text-sm text-ink placeholder:text-ink-muted focus:outline-none ${focusClassName}`}
    />
  );
}
