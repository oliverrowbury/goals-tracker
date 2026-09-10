"use client";

import { useState, useTransition } from "react";
import { savePromptResponse } from "./journal/actions";

export function PromptOfDayCard({
  dateISO,
  prompt,
  initialResponse,
}: {
  dateISO: string;
  prompt: string;
  initialResponse: string;
}) {
  const [response, setResponse] = useState(initialResponse);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function save() {
    startTransition(async () => {
      await savePromptResponse(dateISO, response);
      setSavedAt(new Date());
    });
  }

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl border border-line bg-card p-7 shadow-sm sm:p-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">Proudly Prompt of the Day</p>
      <p className="mt-2 max-w-xl font-serif text-xl font-semibold leading-snug text-ink sm:text-2xl">{prompt}</p>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        onBlur={save}
        placeholder="Type your answer…"
        rows={2}
        className="mt-4 w-full resize-y rounded-xl border border-line bg-paper p-3.5 text-[15px] leading-relaxed text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {savedAt && !isPending && <span className="text-xs text-ink-muted">Saved</span>}
      </div>
    </div>
  );
}
