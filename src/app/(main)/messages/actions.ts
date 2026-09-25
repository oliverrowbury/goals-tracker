"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { isMutualFollow, isBlocked } from "@/lib/friends";
import { sendNewMessageEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

const MAX_MESSAGE_LENGTH = 2000;
const MESSAGE_RATE_LIMIT = 20;
const MESSAGE_RATE_WINDOW_MS = 60_000;

export type SendMessageState = { error?: string } | null;

// Mutual-follow gated (see lib/friends.ts) — stricter than the rest of the
// app's one-directional Follow model, checked here server-side rather than
// trusted from whatever page linked here, same reasoning as likeActivity in
// friends/actions.ts re-checking its own privacy boundary.
export async function sendMessage(recipientId: string, formData: FormData): Promise<SendMessageState> {
  const user = await getCurrentUser();
  if (recipientId === user.id) return { error: "That's you" };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Type something first." };
  if (body.length > MAX_MESSAGE_LENGTH) return { error: `Keep it under ${MAX_MESSAGE_LENGTH} characters.` };

  const recentCount = await prisma.message.count({
    where: { senderId: user.id, createdAt: { gt: new Date(Date.now() - MESSAGE_RATE_WINDOW_MS) } },
  });
  if (recentCount >= MESSAGE_RATE_LIMIT) return { error: "Slow down — too many messages in a row. Try again in a minute." };

  const [recipient, mutual, blocked] = await Promise.all([
    prisma.user.findUnique({ where: { id: recipientId }, select: { id: true, name: true, email: true, username: true } }),
    isMutualFollow(user.id, recipientId),
    isBlocked(user.id, recipientId),
  ]);
  if (!recipient || !mutual || blocked) return { error: "You can only message mutual friends." };

  // Only notify on the *first* unread message in this thread, not every
  // one — otherwise an active back-and-forth would spam email/push.
  const hadUnread = await prisma.message.findFirst({
    where: { senderId: user.id, recipientId, readAt: null },
    select: { id: true },
  });

  // The actual DB write is the one step here that must not silently fail —
  // everything after it (email/push) already can't crash the send. Wrapped
  // so a real failure comes back as visible text in the composer instead of
  // an unhandled rejection with nothing to go on.
  try {
    await prisma.message.create({ data: { senderId: user.id, recipientId, body } });
  } catch (err) {
    console.error("Failed to save message:", err);
    return { error: `Message didn't send: ${err instanceof Error ? err.message : "unknown error"}` };
  }

  if (!hadUnread) {
    // Awaited (not fire-and-forget) — see signup/actions.ts's note on why:
    // a serverless function can be frozen right after it returns, which
    // would cut off a dangling unawaited send. sendNewMessageEmail already
    // never throws (see lib/email.ts); sendPushToUser does when VAPID isn't
    // configured, so that one's wrapped rather than assumed to succeed.
    await sendNewMessageEmail(recipient.email, recipient.name, user.name);
    try {
      await sendPushToUser(recipientId, { title: `${user.name} messaged you`, body, url: `/messages/${user.username}` });
    } catch (err) {
      console.error("Failed to send push notification for new message:", err);
    }
  }

  revalidatePath(`/messages/${recipient.username}`);
  revalidatePath("/messages");
  return null;
}

export async function markThreadRead(otherUserId: string): Promise<void> {
  const user = await getCurrentUser();
  await prisma.message.updateMany({
    where: { senderId: otherUserId, recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/messages");
}

export type MessageDTO = { id: string; senderId: string; body: string; createdAt: string };

// Read-only, polled by MessageThread while a conversation is open — the
// only polling in this app (everything else is request/response), since a
// chat screen that never updates on its own would feel broken. Marks
// whatever it returns from the other person as read, same as opening the
// thread does, since fetching new messages into an open conversation is
// exactly that.
export async function getNewMessages(otherUserId: string, afterId: string | null): Promise<MessageDTO[]> {
  const user = await getCurrentUser();
  if (!(await isMutualFollow(user.id, otherUserId))) return [];

  let afterCreatedAt: Date | undefined;
  if (afterId) {
    const anchor = await prisma.message.findUnique({ where: { id: afterId }, select: { createdAt: true } });
    afterCreatedAt = anchor?.createdAt;
  }

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: user.id, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: user.id },
      ],
      ...(afterCreatedAt ? { createdAt: { gt: afterCreatedAt } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, senderId: true, body: true, createdAt: true },
  });

  const justArrived = messages.filter((m) => m.senderId === otherUserId);
  if (justArrived.length > 0) {
    await prisma.message.updateMany({
      where: { id: { in: justArrived.map((m) => m.id) }, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));
}
