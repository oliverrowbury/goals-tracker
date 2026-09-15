"use client";

import { useState, useTransition } from "react";
import { searchUsers, followUser, unfollowUser, type FriendSearchResult } from "./actions";

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

  function handleFollow(target: FriendSearchResult) {
    startTransition(async () => {
      const result = await followUser(target.id);
      setMessage(result?.error ?? result?.success ?? null);
      const r = await searchUsers(query);
      setResults(r);
    });
  }

  function handleUnfollow(target: FriendSearchResult) {
    startTransition(async () => {
      await unfollowUser(target.id);
      setMessage(null);
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
              {r.following ? (
                <button
                  type="button"
                  onClick={() => handleUnfollow(r)}
                  disabled={isPending}
                  className="shrink-0 rounded-lg border border-line px-3 py-1 text-xs font-medium text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  Following
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleFollow(r)}
                  disabled={isPending}
                  className="shrink-0 rounded-lg bg-calm px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Follow
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {searched && results.length === 0 && !isPending && <p className="mt-2 text-xs text-ink-muted">No matches.</p>}
      {message && <p className="mt-2 text-xs text-accent">{message}</p>}
    </div>
  );
}
