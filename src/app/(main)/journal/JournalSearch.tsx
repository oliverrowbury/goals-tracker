"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { SearchIcon, CloseIcon } from "@/components/Icons";
import { formatLong } from "@/lib/dates";
import { searchJournalEntries, type JournalSearchResult } from "./actions";

const DEBOUNCE_MS = 300;

export function JournalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JournalSearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleChange(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchJournalEntries(value));
      });
    }, DEBOUNCE_MS);
  }

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search journal"
        title="Search journal"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-accent hover:text-accent"
      >
        <SearchIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 rounded-lg border border-accent bg-paper px-2.5 py-1.5">
        <SearchIcon className="h-4 w-4 shrink-0 text-ink-muted" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search your journal…"
          className="w-40 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none sm:w-56"
        />
        <button type="button" onClick={close} aria-label="Close search" className="shrink-0 text-ink-muted hover:text-ink">
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {query.trim().length >= 2 && (
        <div className="absolute left-0 top-full z-20 mt-1.5 max-h-80 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-line bg-card p-1.5 shadow-lg sm:w-96">
          {isPending ? (
            <p className="px-3 py-2 text-sm text-ink-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-muted">No entries match &ldquo;{query}&rdquo;.</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.dateISO}>
                  <Link
                    href={`/journal?date=${r.dateISO}`}
                    onClick={close}
                    className="block rounded-lg px-3 py-2 hover:bg-line/50"
                  >
                    <p className="text-xs font-medium text-accent">{formatLong(r.dateISO)}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{r.snippet}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
