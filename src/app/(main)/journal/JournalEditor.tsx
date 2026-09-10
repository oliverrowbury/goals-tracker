"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveJournalEntry } from "./actions";

type Mode = "freewrite" | "list";

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

function useFieldMode(storageKey: string) {
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
  }

  return { mode, changeMode };
}

// Each bullet is its own row rather than a "•" character typed into a plain
// textarea — that's what makes the faded/solid distinction possible at all
// (a textarea can't style individual lines differently), and it means
// switching back to Freewrite can never leave a stray bullet character
// behind, because none is ever stored in the text in the first place.
function ListRow({
  value,
  placeholder,
  onChange,
  onAdvance,
  onBackspaceEmpty,
  inputRef,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onAdvance: () => void;
  onBackspaceEmpty?: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const filled = value.trim() !== "";
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${filled ? "bg-ink" : "bg-line"}`} />
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          if (next.length === value.length + 1 && next.endsWith(".")) {
            onChange(next.slice(0, -1));
            onAdvance();
          } else {
            onChange(next);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdvance();
          } else if (e.key === "Backspace" && value === "" && onBackspaceEmpty) {
            e.preventDefault();
            onBackspaceEmpty();
          }
        }}
        className="flex-1 border-none bg-transparent p-0 font-serif text-[16px] text-ink placeholder:font-sans placeholder:text-ink-muted focus:outline-none focus:ring-0"
      />
    </div>
  );
}

function ListEditor({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  // Always at least one row — the row you're currently typing into is a
  // real, stable array item from the moment it exists, never a separate
  // "ghost" swapped out mid-keystroke. An earlier version tried to fake
  // the next-empty-row as a not-yet-real placeholder and it lost
  // characters under fast typing (a React key/reconciliation race) —
  // this way there's nothing to race.
  const items = value === "" ? [""] : value.split("\n");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focusIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (focusIndexRef.current !== null) {
      refs.current[focusIndexRef.current]?.focus();
      focusIndexRef.current = null;
    }
  });

  function setItem(i: number, v: string) {
    const next = [...items];
    next[i] = v;
    onChange(next.join("\n"));
  }

  function advance(i: number) {
    if (i === items.length - 1) {
      onChange([...items, ""].join("\n"));
    }
    focusIndexRef.current = i + 1;
  }

  function removeItem(i: number) {
    if (i === 0) return; // always keep at least one row to type into
    onChange(items.filter((_, idx) => idx !== i).join("\n"));
    focusIndexRef.current = i - 1;
  }

  return (
    <div className="w-full rounded-2xl border border-line bg-card p-5 focus-within:border-accent">
      {items.map((item, i) => (
        <ListRow
          key={i}
          value={item}
          placeholder={items.length === 1 && i === 0 ? placeholder : undefined}
          inputRef={(el) => {
            refs.current[i] = el;
          }}
          onChange={(v) => setItem(i, v)}
          onAdvance={() => advance(i)}
          onBackspaceEmpty={() => removeItem(i)}
        />
      ))}
      {/* Purely decorative — invites continuing the list without being real inputs. */}
      <div className="flex items-center gap-2.5 py-1 opacity-40">
        <span className="h-1.5 w-1.5 rounded-full bg-line" />
      </div>
      <div className="flex items-center gap-2.5 py-1 opacity-20">
        <span className="h-1.5 w-1.5 rounded-full bg-line" />
      </div>
    </div>
  );
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
  const { mode: proudMode, changeMode: changeProudMode } = useFieldMode("journal-mode-proud");
  const { mode: improveMode, changeMode: changeImproveMode } = useFieldMode("journal-mode-improve");
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
      {proudMode === "list" ? (
        <ListEditor value={text} onChange={setText} placeholder="What are you proud of today?" />
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What are you proud of today?"
          rows={10}
          className="w-full resize-y rounded-2xl border border-line bg-card p-5 font-serif text-[16px] leading-relaxed text-ink placeholder:text-ink-muted placeholder:font-sans focus:border-accent focus:outline-none"
        />
      )}

      <p className="mb-2 mt-5 text-sm font-medium text-ink-muted">What didn't go well / what to improve</p>
      <ModeToggle mode={improveMode} onChange={changeImproveMode} />
      {improveMode === "list" ? (
        <ListEditor value={improveText} onChange={setImproveText} placeholder="What could've gone better today?" />
      ) : (
        <textarea
          value={improveText}
          onChange={(e) => setImproveText(e.target.value)}
          placeholder="What could've gone better today?"
          rows={6}
          className="w-full resize-y rounded-2xl border border-line bg-card p-5 font-serif text-[16px] leading-relaxed text-ink placeholder:text-ink-muted placeholder:font-sans focus:border-accent focus:outline-none"
        />
      )}

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
