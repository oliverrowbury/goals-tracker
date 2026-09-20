"use client";

import { useState, useTransition } from "react";
import { resendVerificationEmail } from "./actions";

// Dismissible for the rest of this visit (plain component state, not
// persisted) — reappears next time the app's opened fresh rather than
// nagging mid-session, but also doesn't let itself be silenced forever
// the way a localStorage dismiss would.
export function VerifyEmailBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-accent-soft px-4 py-2.5 text-sm text-accent-strong">
      <p>
        {sent ? "Verification email sent — check your inbox." : "Verify your email to keep your account fully secure."}
      </p>
      <div className="flex shrink-0 items-center gap-3">
        {!sent && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => { await resendVerificationEmail(); setSent(true); })}
            className="font-medium underline hover:opacity-80 disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Resend email"}
          </button>
        )}
        <button type="button" onClick={() => setDismissed(true)} className="text-accent-strong/70 hover:text-accent-strong">
          Dismiss
        </button>
      </div>
    </div>
  );
}
