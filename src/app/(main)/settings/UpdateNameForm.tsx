"use client";

import { useFormStatus } from "react-dom";
import { updateName } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

// Same "wrap the shared submit button in its own client component so
// useFormStatus can see the form" pattern as UsernameForm/ProfileForm/etc
// — the form itself stays a plain server action, only the button needs to
// be a client component.
export function UpdateNameForm({ name }: { name: string }) {
  return (
    <form action={updateName} className="mt-4 flex max-w-sm gap-2">
      <input
        name="name"
        defaultValue={name}
        required
        pattern="\S+\s+\S.*"
        title="First and last name"
        className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />
      <SubmitButton />
    </form>
  );
}
