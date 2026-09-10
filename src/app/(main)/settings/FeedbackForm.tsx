"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendFeedback } from "./actions";

export function FeedbackForm() {
  const [state, formAction, isPending] = useActionState(sendFeedback, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isPending && state?.success) formRef.current?.reset();
  }, [isPending, state]);

  return (
    <form ref={formRef} action={formAction} className="max-w-sm space-y-3">
      {state?.error && <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">{state.error}</p>}
      {state?.success && <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-strong">{state.success}</p>}

      <textarea
        name="message"
        required
        rows={3}
        placeholder="Bugs, ideas, anything you'd want changed…"
        className="w-full resize-y rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
