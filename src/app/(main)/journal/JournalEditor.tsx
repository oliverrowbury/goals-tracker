"use client";

import { useState, useTransition } from "react";
import { saveJournalEntry } from "./actions";

export function JournalEditor({ dateISO, initialText }: { dateISO: string; initialText: string }) {
  const [text, setText] = useState(initialText);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function save() {
    startTransition(async () => {
      await saveJournalEntry(dateISO, text);
      setSavedAt(new Date());
    });
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What are you proud of today? What did you struggle with?"
        rows={14}
        className="w-full resize-y rounded-lg border border-neutral-300 bg-white p-4 text-[15px] leading-relaxed focus:border-neutral-500 focus:outline-none"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {savedAt && !isPending && (
          <span className="text-sm text-neutral-500">
            Saved at {savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}
