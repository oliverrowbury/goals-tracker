"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { verifyEmailCode, resendVerificationCode } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-sheen relative w-full overflow-hidden rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Checking…" : "Verify email"}
    </button>
  );
}

export function VerifyCodeForm({ email }: { email: string }) {
  const boundVerify = verifyEmailCode.bind(null, email);
  const [state, formAction] = useActionState(boundVerify, null);
  const [isResending, startResend] = useTransition();
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  function handleResend() {
    setResendMessage(null);
    startResend(async () => {
      const result = await resendVerificationCode(email);
      setResendMessage(result?.cooldown ? "Already sent recently, check your inbox (and spam)." : "Sent, check your inbox.");
    });
  }

  return (
    <form
      action={formAction}
      className="relative z-10 w-full max-w-sm animate-[card-in_0.75s_cubic-bezier(0.16,1,0.3,1)_both] rounded-2xl border border-line bg-card p-7 shadow-lg"
    >
      <h1 className="mb-1 text-3xl text-ink">
        <Wordmark animated />
      </h1>

      <div className="animate-[fade-up_0.6s_cubic-bezier(0.16,1,0.3,1)_both] [animation-delay:1s]">
        <p className="mb-6 text-sm text-ink-muted">
          We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>. Enter it below.
        </p>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="code">
            Verification code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            autoFocus
            placeholder="123456"
            aria-invalid={!!state?.error}
            className={`mb-1 w-full rounded-lg border bg-paper px-3 py-2 text-center text-lg tracking-[0.3em] focus:outline-none ${
              state?.error ? "border-accent" : "border-line focus:border-accent"
            }`}
          />
          {state?.error && <p className="text-xs text-accent-strong">{state.error}</p>}
        </div>

        <SubmitButton />

        <div className="mt-4 text-center text-sm text-ink-muted">
          <button type="button" onClick={handleResend} disabled={isResending} className="font-medium text-accent hover:underline disabled:opacity-50">
            {isResending ? "Sending…" : "Resend code"}
          </button>
          {resendMessage && <p className="mt-1.5 text-xs text-ink-muted">{resendMessage}</p>}
        </div>

        <p className="mt-4 text-center text-sm text-ink-muted">
          Wrong email?{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Start over
          </Link>
        </p>
      </div>
    </form>
  );
}
