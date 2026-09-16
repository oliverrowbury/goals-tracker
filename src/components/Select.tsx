import type { SelectHTMLAttributes } from "react";
import { ChevronDownIcon } from "@/components/Icons";

// Every <select> in the app got only the shared border/padding treatment,
// leaving the browser's own dropdown arrow showing — the one piece of
// native chrome visibly out of step with the rest of the custom-styled
// form language. `appearance-none` strips that arrow; this draws a
// matching one back in CSS rather than JS, so the control itself is still
// a plain native <select> (full keyboard/a11y behavior, no JS listbox).
export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`appearance-none pr-8 ${className}`}>
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}
