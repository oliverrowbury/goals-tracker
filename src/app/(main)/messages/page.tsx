import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { todayISO, shiftISO, weekdayShortDay } from "@/lib/dates";
import { Avatar } from "@/components/Avatar";
import { MessageIcon } from "@/components/Icons";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

function dayLabel(date: Date): string {
  const dateISO = date.toISOString().slice(0, 10);
  const today = todayISO();
  if (dateISO === today) return "Today";
  if (dateISO === shiftISO(today, -1)) return "Yesterday";
  return weekdayShortDay(dateISO);
}

type ConversationPreview = {
  otherId: string;
  otherName: string;
  otherUsername: string;
  otherAvatarUrl: string | null;
  lastBody: string;
  lastAt: Date;
  lastFromMe: boolean;
  unreadCount: number;
};

export default async function MessagesPage() {
  const user = await getCurrentUser();

  const [messages, following, followers] = await Promise.all([
    prisma.message.findMany({
      where: { OR: [{ senderId: user.id }, { recipientId: user.id }] },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
        recipient: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    }),
    prisma.follow.findMany({ where: { followerId: user.id, status: "ACCEPTED" }, select: { followingId: true } }),
    prisma.follow.findMany({ where: { followingId: user.id, status: "ACCEPTED" }, select: { followerId: true } }),
  ]);

  // Threads are derived from Message rows at render time (no separate
  // Conversation table) — messages already come back newest-first, so a
  // Map keyed by counterpart id naturally keeps just the latest one per
  // thread while still letting unread rows from anywhere in the list count.
  const conversations = new Map<string, ConversationPreview>();
  for (const m of messages) {
    const mine = m.senderId === user.id;
    const otherId = mine ? m.recipientId : m.senderId;
    const other = mine ? m.recipient : m.sender;
    if (!conversations.has(otherId)) {
      conversations.set(otherId, {
        otherId,
        otherName: other.name,
        otherUsername: other.username,
        otherAvatarUrl: other.avatarUrl,
        lastBody: m.body,
        lastAt: m.createdAt,
        lastFromMe: mine,
        unreadCount: 0,
      });
    }
    if (!mine && m.readAt === null) conversations.get(otherId)!.unreadCount++;
  }
  const conversationList = Array.from(conversations.values());

  const followingIds = new Set(following.map((f) => f.followingId));
  const mutualFriendIds = followers.map((f) => f.followerId).filter((id) => followingIds.has(id) && !conversations.has(id));
  const newFriends =
    mutualFriendIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: mutualFriendIds } },
          select: { id: true, name: true, username: true, avatarUrl: true },
          orderBy: { name: "asc" },
        })
      : [];

  return (
    <div>
      <PageHeader icon={MessageIcon} iconClassName="text-calm" title="Messages" />

      {conversationList.length === 0 && newFriends.length === 0 && (
        <EmptyState
          icon={MessageIcon}
          iconClassName="bg-calm-soft text-calm"
          message="No conversations yet — you can message someone once you both follow each other. Follow each other on the Friends page first."
        />
      )}

      {conversationList.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
          {conversationList.map((c) => (
            <li key={c.otherId}>
              <Link href={`/messages/${c.otherUsername}`} className="flex items-center gap-3 p-4 hover:bg-paper">
                <Avatar name={c.otherName} avatarUrl={c.otherAvatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium text-ink">{c.otherName}</p>
                    <span className="shrink-0 text-xs text-ink-muted">{dayLabel(c.lastAt)}</span>
                  </div>
                  <p className="truncate text-sm text-ink-muted">
                    {c.lastFromMe && "You: "}
                    {c.lastBody}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-calm px-1.5 text-xs font-medium text-white">
                    {c.unreadCount}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {newFriends.length > 0 && (
        <div className={conversationList.length > 0 ? "mt-8" : ""}>
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Start a conversation</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {newFriends.map((f) => (
              <li key={f.id}>
                <Link href={`/messages/${f.username}`} className="flex items-center gap-3 p-4 hover:bg-paper">
                  <Avatar name={f.name} avatarUrl={f.avatarUrl} size={36} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{f.name}</p>
                    <p className="truncate text-sm text-ink-muted">@{f.username}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
