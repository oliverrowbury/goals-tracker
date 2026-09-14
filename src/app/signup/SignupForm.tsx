"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Wordmark } from "@/components/Wordmark";
import { signup } from "./actions";

const inputClass =
  "mb-1 w-full rounded-lg border bg-paper px-3 py-2 text-sm focus:outline-none";

function Field({
  id,
  label,
  type,
  autoComplete,
  autoFocus,
  error,
  defaultValue,
}: {
  id: "name" | "email" | "password" | "confirmPassword";
  label: string;
  type: string;
  autoComplete: string;
  autoFocus?: boolean;
  error?: string;
  defaultValue?: string;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium text-ink" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        defaultValue={defaultValue}
        aria-invalid={!!error}
        className={`${inputClass} ${error ? "border-accent" : "border-line focus:border-accent"}`}
      />
      {error && <p className="text-xs text-accent-strong">{error}</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong hover:shadow-md active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create account"}
    </button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState(signup, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form
      action={formAction}
      className="w-full max-w-sm animate-[fade-up_0.5s_ease-out_both] rounded-2xl border border-line bg-card p-7 shadow-lg"
    >
      <h1 className="mb-1 text-3xl text-ink">
        <Wordmark />
      </h1>
      <p className="mb-6 text-sm text-ink-muted">Create your own account — your data stays yours alone.</p>

      <Field id="name" label="Name" type="text" autoComplete="name" autoFocus error={errors.name} defaultValue={state?.values.name} />
      <Field id="email" label="Email" type="email" autoComplete="email" error={errors.email} defaultValue={state?.values.email} />
      <Field id="password" label="Password" type="password" autoComplete="new-password" error={errors.password} />
      <Field
        id="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword}
      />

      <SubmitButton />

      <p className="mt-4 text-center text-sm text-ink-muted">
        Already have one?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
