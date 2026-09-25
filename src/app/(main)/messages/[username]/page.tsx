import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { isMutualFollow } from "@/lib/friends";
import { markThreadRead } from "../actions";
import { MessageThread } from "../MessageThread";
import { MessageIcon } from "@/components/Icons";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const other = await prisma.user.findUnique({ where: { username }, select: { name: true } });
  return { title: other ? other.name : "Messages" };
}

export default async function ThreadPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await getCurrentUser();

  const other = await prisma.user.findUnique({
    where: { username },
    select: { id: true, name: true, username: true, avatarUrl: true },
  });
  if (!other) notFound();
  if (other.id === user.id) redirect("/messages");

  // Re-checked here (not just trusted from whichever link got us here) —
  // same reasoning as every other cross-user read in this app.
  if (!(await isMutualFollow(user.id, other.id))) redirect("/messages");

  // Opening the thread is "I've seen this" — same as the rest of the app's
  // read-state (e.g. AchievementWatcher piggybacking on a normal page render).
  await markThreadRead(other.id);

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: user.id, recipientId: other.id },
        { senderId: other.id, recipientId: user.id },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, senderId: true, body: true, createdAt: true, readAt: true },
  });

  return (
    <div>
      <PageHeader
        icon={MessageIcon}
        iconClassName="text-calm"
        title={other.name}
        subtitle={<p className="text-sm text-ink-muted">@{other.username}</p>}
        align="baseline"
        className="mb-4"
        right={
          <Link href="/messages" className="text-sm text-ink-muted hover:text-calm">
            ← All messages
          </Link>
        }
      />
      <MessageThread
        // Keyed on the conversation so navigating from one thread straight
        // to another (same route, different params) remounts rather than
        // reusing state — otherwise useState's initialMessages would only
        // ever apply once and a stale conversation could bleed into a new one.
        key={other.id}
        currentUserId={user.id}
        otherUserId={other.id}
        otherName={other.name}
        otherAvatarUrl={other.avatarUrl}
        initialMessages={messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          readAt: m.readAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
