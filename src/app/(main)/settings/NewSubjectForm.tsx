"use client";

import { useState, useTransition } from "react";
import { createSubject } from "../study/actions";

export function NewSubjectForm() {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");

  return (
    <form
      action={(formData) => {
        startTransition(() => createSubject(formData));
        setName("");
      }}
      className="flex max-w-sm gap-2"
    >
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Add a subject…"
        className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
