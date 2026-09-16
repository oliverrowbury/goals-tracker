"use client";

import { removeFollowByTarget } from "./actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export function UnfollowButton({ userId, name }: { userId: string; name: string }) {
  return (
    <ConfirmButton
      triggerClassName="text-sm text-ink-muted hover:text-accent disabled:opacity-50"
      title="Unfollow?"
      message={`Unfollow ${name}? You can always follow them again later.`}
      confirmLabel="Unfollow"
      destructive={false}
      onConfirm={() => removeFollowByTarget(userId)}
    >
      Unfollow
    </ConfirmButton>
  );
}
