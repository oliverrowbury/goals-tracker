"use client";

import { useEffect, useState, useTransition } from "react";
import { saveJournalEntry } from "./actions";

type Mode = "freewrite" | "list";

// List mode: finishing a sentence with "." at the end starts a new bullet
// on the next line instead of just continuing the paragraph.
function applyListMode(mode: Mode, prev: string, next: string): string {
  if (mode === "list" && next.length === prev.length + 1 && next.endsWith(".")) {
    return `${next.slice(0, -1)}\n• `;
  }
  return next;
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="mb-2 flex items-center gap-1 text-xs">
      <button
        type="button"
        onClick={() => onChange("freewrite")}
        className={`rounded-full px-2.5 py-1 font-medium ${
          mode === "freewrite" ? "bg-accent text-white" : "text-ink-muted hover:text-accent"
        }`}
      >
        Freewrite
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`rounded-full px-2.5 py-1 font-medium ${
          mode === "list" ? "bg-accent text-white" : "text-ink-muted hover:text-accent"
        }`}
      >
        List
      </button>
    </div>
  );
}

function useFieldMode(storageKey: string, text: string, setText: (t: string) => void) {
  const [mode, setMode] = useState<Mode>("freewrite");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "list" || stored === "freewrite") setMode(stored);
    } catch {
      // ignore — just falls back to freewrite
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeMode(next: Mode) {
    setMode(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // not persisted this session — not worth surfacing to the user
    }
    if (next === "list" && text.trim() === "") setText("• ");
  }

  return { mode, changeMode };
}

export function JournalEditor({
  dateISO,
  initialText,
  initialImproveText,
}: {
  dateISO: string;
  initialText: string;
  initialImproveText: string;
}) {
  const [text, setText] = useState(initialText);
  const [improveText, setImproveText] = useState(initialImproveText);
  const { mode: proudMode, changeMode: changeProudMode } = useFieldMode("journal-mode-proud", text, setText);
  const { mode: improveMode, changeMode: changeImproveMode } = useFieldMode(
    "journal-mode-improve",
    improveText,
    setImproveText,
  );
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function save() {
    startTransition(async () => {
      await saveJournalEntry(dateISO, text, improveText);
      setSavedAt(new Date());
    });
  }

  return (
    <div>
      <ModeToggle mode={proudMode} onChange={changeProudMode} />
      <textarea
        value={text}
        onChange={(e) => setText(applyListMode(proudMode, text, e.target.value))}
        placeholder="What are you proud of today?"
        rows={10}
        className="w-full resize-y rounded-2xl border border-line bg-card p-5 font-serif text-[16px] leading-relaxed text-ink placeholder:text-ink-muted placeholder:font-sans focus:border-accent focus:outline-none"
      />

      <p className="mb-2 mt-5 text-sm font-medium text-ink-muted">What didn't go well / what to improve</p>
      <ModeToggle mode={improveMode} onChange={changeImproveMode} />
      <textarea
        value={improveText}
        onChange={(e) => setImproveText(applyListMode(improveMode, improveText, e.target.value))}
        placeholder="What could've gone better today?"
        rows={6}
        className="w-full resize-y rounded-2xl border border-line bg-card p-5 font-serif text-[16px] leading-relaxed text-ink placeholder:text-ink-muted placeholder:font-sans focus:border-accent focus:outline-none"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {savedAt && !isPending && (
          <span className="text-sm text-ink-muted">
            Saved at {savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}
