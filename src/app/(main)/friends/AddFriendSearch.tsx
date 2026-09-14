"use client";

import { useState, useTransition } from "react";
import { searchUsers, sendFriendRequestTo, type FriendSearchResult } from "./actions";

export function AddFriendSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    setQuery(value);
    setMessage(null);
    startTransition(async () => {
      const r = await searchUsers(value);
      setResults(r);
      setSearched(value.trim().length >= 2);
    });
  }

  function handleAdd(target: FriendSearchResult) {
    startTransition(async () => {
      const result = await sendFriendRequestTo(target.id);
      setMessage(result?.error ?? result?.success ?? null);
      const r = await searchUsers(query);
      setResults(r);
    });
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search by username, or paste an exact email"
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:border-calm focus:outline-none"
      />

      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
          {results.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium text-ink">{r.name}</span>{" "}
                <span className="text-ink-muted">@{r.username}</span>
              </span>
              {r.status === "none" && (
                <button
                  type="button"
                  onClick={() => handleAdd(r)}
                  disabled={isPending}
                  className="shrink-0 rounded-lg bg-calm px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Add
                </button>
              )}
              {r.status === "pending_sent" && <span className="shrink-0 text-xs text-ink-muted">Request sent</span>}
              {r.status === "pending_received" && <span className="shrink-0 text-xs text-ink-muted">Respond below</span>}
              {r.status === "friends" && <span className="shrink-0 text-xs text-calm">Friends</span>}
            </li>
          ))}
        </ul>
      )}

      {searched && results.length === 0 && !isPending && <p className="mt-2 text-xs text-ink-muted">No matches.</p>}
      {message && <p className="mt-2 text-xs text-accent">{message}</p>}
    </div>
  );
}
