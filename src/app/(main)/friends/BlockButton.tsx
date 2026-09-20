"use client";

import { ConfirmButton } from "@/components/ConfirmButton";
import { blockUser, unblockUser } from "./actions";

export function BlockButton({ targetUserId, targetName, blocked }: { targetUserId: string; targetName: string; blocked: boolean }) {
  if (blocked) {
    return (
      <ConfirmButton
        triggerClassName="text-sm text-ink-muted hover:text-accent"
        title={`Unblock ${targetName}?`}
        message="They'll be able to follow, message, and comment on your posts again."
        confirmLabel="Unblock"
        destructive={false}
        onConfirm={() => unblockUser(targetUserId)}
      >
        Unblock
      </ConfirmButton>
    );
  }

  return (
    <ConfirmButton
      triggerClassName="text-xs font-medium text-ink-muted hover:text-accent"
      title={`Block ${targetName}?`}
      message="This unfollows each other, and stops them following, messaging, or commenting on you. You can unblock any time."
      confirmLabel="Block"
      onConfirm={() => blockUser(targetUserId)}
    >
      Block
    </ConfirmButton>
  );
}
