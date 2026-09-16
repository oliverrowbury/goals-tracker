"use client";

import { useState, useTransition, type ReactNode } from "react";

// Same fixed-overlay/centered-card shell MoodCheckInModal already uses,
// generalized into a reusable confirm dialog for destructive/discard
// actions — replaces the browser's native confirm(), which looks like an
// unfinished dev build next to the rest of the app's design.
export function ConfirmButton({
  children,
  triggerClassName,
  triggerTitle,
  disabled,
  title,
  message,
  confirmLabel = "Confirm",
  destructive = true,
  onConfirm,
}: {
  children: ReactNode;
  triggerClassName?: string;
  triggerTitle?: string;
  disabled?: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        title={triggerTitle}
        disabled={disabled || isPending}
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm animate-[fade-in_0.15s_ease]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm animate-[fade-up_0.2s_ease] rounded-2xl border border-line bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-serif text-lg font-semibold text-ink">{title}</p>
            <p className="mt-1.5 text-sm text-ink-muted">{message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  startTransition(onConfirm);
                }}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  destructive ? "bg-accent hover:bg-accent-strong" : "bg-ink-solid hover:opacity-90"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
