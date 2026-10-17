"use client";

import { PASSWORD_REQUIREMENTS } from "@/lib/passwordPolicy";
import { CheckIcon } from "@/components/Icons";

// Shown under a new-password field once the user starts typing — hidden
// before that so an empty field doesn't open with a red "weak" bar, which
// reads as scolding someone for not having typed anything yet.
export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const metCount = PASSWORD_REQUIREMENTS.filter((r) => r.test(password)).length;
  const total = PASSWORD_REQUIREMENTS.length;
  const label = metCount === total ? "Strong" : metCount >= total - 1 ? "Okay" : "Weak";
  const color = metCount === total ? "var(--study)" : metCount >= total - 1 ? "var(--deadline)" : "var(--workout)";

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1">
          {PASSWORD_REQUIREMENTS.map((r, i) => (
            <span
              key={r.key}
              className="h-full flex-1 rounded-full transition-colors"
              style={{ backgroundColor: i < metCount ? color : "var(--line)" }}
            />
          ))}
        </div>
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_REQUIREMENTS.map((r) => {
          const met = r.test(password);
          return (
            <li key={r.key} className={`flex items-center gap-1.5 text-xs ${met ? "text-accent" : "text-ink-muted"}`}>
              <span
                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                  met ? "border-accent bg-accent text-white" : "border-line"
                }`}
              >
                {met && <CheckIcon className="h-2.5 w-2.5" />}
              </span>
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
