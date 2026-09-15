"use client";

import { useTransition } from "react";
import { unfollowUser } from "./actions";

export function UnfollowButton({ userId, name }: { userId: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm(`Unfollow ${name}?`)) {
          startTransition(() => unfollowUser(userId));
        }
      }}
      className="text-sm text-ink-muted hover:text-accent disabled:opacity-50"
    >
      Unfollow
    </button>
  );
}
