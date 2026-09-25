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
// A typingAt older than this reads as "not typing anymore" even if the
// client never explicitly cleared it (tab closed, phone locked mid-message).
const TYPING_STALE_MS = 6_000;

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

  // Belt-and-suspenders alongside the client's own clear-on-send — a
  // message just went out, so "typing" is over regardless of whether the
  // client's own setTyping(false) call actually lands.
  if (user.typingWithUserId === recipientId) {
    await prisma.user.update({ where: { id: user.id }, data: { typingWithUserId: null, typingAt: null } });
  }

  revalidatePath(`/messages/${recipient.username}`);
  revalidatePath("/messages");
  return null;
}

// Only the sender can delete their own message — same "delete for
// everyone" model iMessage/WhatsApp use for your own messages, rather than
// a per-viewer "delete for me" that would need a join table to track who's
// hidden what. Hard delete: nothing about a removed message is worth
// keeping around once it's gone.
export async function deleteMessage(messageId: string): Promise<{ error?: string } | null> {
  const user = await getCurrentUser();
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { senderId: true, recipient: { select: { username: true } } },
  });
  if (!message || message.senderId !== user.id) return { error: "Can't delete that." };

  await prisma.message.delete({ where: { id: messageId } });
  revalidatePath(`/messages/${message.recipient.username}`);
  revalidatePath("/messages");
  return null;
}

// Fire-and-forget-ish signal for the typing bubble — throttled client-side
// (see MessageThread) so this fires roughly once every couple seconds while
// actually typing, not on every keystroke. Mutual-follow isn't re-checked
// here: worst case a stale/former "friend" learns you're typing, which
// isMutualFollow already guards on the READING side (getNewMessages below)
// — nothing here is visible to anyone who can't already see the thread.
export async function setTyping(otherUserId: string, typing: boolean): Promise<void> {
  const user = await getCurrentUser();
  await prisma.user.update({
    where: { id: user.id },
    data: typing ? { typingWithUserId: otherUserId, typingAt: new Date() } : { typingWithUserId: null, typingAt: null },
  });
}

// Called directly from the thread page's own render (not a client-triggered
// form/transition) — revalidatePath is only valid inside an actual Server
// Action invocation or a Route Handler, and throws ("used revalidatePath ...
// inside a Server Component render") when called mid-render like this does.
// That's exactly what this was doing, every single time anyone opened a
// chat — which is almost certainly the real "messages don't work" bug this
// whole time. Safe to just drop: both this page and /messages itself are
// force-dynamic, so they already refetch fresh on every navigation with
// nothing cached to invalidate.
export async function markThreadRead(otherUserId: string): Promise<void> {
  const user = await getCurrentUser();
  await prisma.message.updateMany({
    where: { senderId: otherUserId, recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export type MessageDTO = { id: string; senderId: string; body: string; createdAt: string; readAt: string | null };
export type PollResult = {
  messages: MessageDTO[];
  // The read status of the caller's own most recent message in this thread
  // — returned on every poll (not just when new messages arrive), since
  // the other person reading an already-fetched message doesn't create a
  // new row for the `afterId` cursor below to pick up. Only the latest one
  // matters: that's the only message the "Seen"/"Delivered" label ever
  // shows under (see MessageThread).
  myLastMessage: { id: string; readAt: string | null } | null;
  otherTyping: boolean;
};

// Read-only, polled by MessageThread while a conversation is open — the
// only polling in this app (everything else is request/response), since a
// chat screen that never updates on its own would feel broken. Marks
// whatever it returns from the other person as read, same as opening the
// thread does, since fetching new messages into an open conversation is
// exactly that. Also carries the typing-bubble signal and the caller's own
// read-receipt status, piggybacked on this same request rather than a
// second poll loop.
export async function getNewMessages(otherUserId: string, afterId: string | null): Promise<PollResult> {
  const user = await getCurrentUser();
  if (!(await isMutualFollow(user.id, otherUserId))) return { messages: [], myLastMessage: null, otherTyping: false };

  let afterCreatedAt: Date | undefined;
  if (afterId) {
    const anchor = await prisma.message.findUnique({ where: { id: afterId }, select: { createdAt: true } });
    afterCreatedAt = anchor?.createdAt;
  }

  const [messages, myLastMessage, other] = await Promise.all([
    prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.id, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: user.id },
        ],
        ...(afterCreatedAt ? { createdAt: { gt: afterCreatedAt } } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, senderId: true, body: true, createdAt: true, readAt: true },
    }),
    prisma.message.findFirst({
      where: { senderId: user.id, recipientId: otherUserId },
      orderBy: { createdAt: "desc" },
      select: { id: true, readAt: true },
    }),
    prisma.user.findUnique({ where: { id: otherUserId }, select: { typingWithUserId: true, typingAt: true } }),
  ]);

  const justArrived = messages.filter((m) => m.senderId === otherUserId);
  if (justArrived.length > 0) {
    await prisma.message.updateMany({
      where: { id: { in: justArrived.map((m) => m.id) }, readAt: null },
      data: { readAt: new Date() },
    });
  }

  const otherTyping =
    other?.typingWithUserId === user.id && !!other.typingAt && Date.now() - other.typingAt.getTime() < TYPING_STALE_MS;

  return {
    messages: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), readAt: m.readAt?.toISOString() ?? null })),
    myLastMessage: myLastMessage ? { id: myLastMessage.id, readAt: myLastMessage.readAt?.toISOString() ?? null } : null,
    otherTyping,
  };
}
