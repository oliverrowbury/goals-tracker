"use client";

import { useTransition } from "react";
import { removeFriendship } from "./actions";

export function RemoveFriendButton({ friendshipId, name }: { friendshipId: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm(`Remove ${name} as a friend?`)) {
          startTransition(() => removeFriendship(friendshipId));
        }
      }}
      className="text-sm text-ink-muted hover:text-accent disabled:opacity-50"
    >
      Remove
    </button>
  );
}
