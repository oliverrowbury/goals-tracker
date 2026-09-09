"use client";

import { useEffect, useState, useTransition } from "react";
import { saveJournalEntry } from "./actions";

type Mode = "freewrite" | "list";
const MODE_KEY = "journal-mode";

export function JournalEditor({ dateISO, initialText }: { dateISO: string; initialText: string }) {
  const [text, setText] = useState(initialText);
  const [mode, setMode] = useState<Mode>("freewrite");
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(MODE_KEY);
      if (stored === "list" || stored === "freewrite") setMode(stored);
    } catch {
      // ignore — just falls back to freewrite
    }
  }, []);

  function changeMode(next: Mode) {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // not persisted this session — not worth surfacing to the user
    }
    if (next === "list" && text.trim() === "") {
      setText("• ");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    // List mode: finishing a sentence with "." at the end starts a new
    // bullet on the next line instead of just continuing the paragraph.
    if (mode === "list" && next.length === text.length + 1 && next.endsWith(".")) {
      setText(`${next.slice(0, -1)}\n• `);
      return;
    }
    setText(next);
  }

  function save() {
    startTransition(async () => {
      await saveJournalEntry(dateISO, text);
      setSavedAt(new Date());
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1 text-xs">
        <button
          type="button"
          onClick={() => changeMode("freewrite")}
          className={`rounded-full px-2.5 py-1 font-medium ${
            mode === "freewrite" ? "bg-accent text-white" : "text-ink-muted hover:text-accent"
          }`}
        >
          Freewrite
        </button>
        <button
          type="button"
          onClick={() => changeMode("list")}
          className={`rounded-full px-2.5 py-1 font-medium ${
            mode === "list" ? "bg-accent text-white" : "text-ink-muted hover:text-accent"
          }`}
        >
          List
        </button>
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="What are you proud of today? What did you struggle with?"
        rows={14}
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
