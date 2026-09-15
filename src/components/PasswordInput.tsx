"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/Icons";

// Same visual footprint as a plain text input everywhere it replaces one —
// callers pass their usual input classes and this adds the reveal toggle
// plus right padding so the icon never overlaps typed text.
export function PasswordInput({
  id,
  name,
  autoComplete,
  autoFocus,
  required,
  minLength,
  defaultValue,
  className,
  ariaInvalid,
}: {
  id: string;
  name?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  minLength?: number;
  defaultValue?: string;
  className?: string;
  ariaInvalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name ?? id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required={required}
        minLength={minLength}
        defaultValue={defaultValue}
        aria-invalid={ariaInvalid}
        className={`${className ?? ""} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-muted hover:text-ink"
      >
        {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}
