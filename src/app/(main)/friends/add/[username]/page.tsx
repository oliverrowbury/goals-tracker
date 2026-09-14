import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { UsersIcon } from "@/components/Icons";
import { sendFriendRequestToVoid, acceptFriendRequest } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AddFriendByLinkPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await getCurrentUser();
  const target = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!target) notFound();

  const isSelf = target.id === user.id;
  const existing = isSelf
    ? null
    : await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: user.id, addresseeId: target.id },
            { requesterId: target.id, addresseeId: user.id },
          ],
        },
      });

  return (
    <div className="mx-auto max-w-sm text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-calm-soft text-calm">
        <UsersIcon className="h-7 w-7" />
      </span>
      <h1 className="mt-4 font-serif text-2xl font-semibold text-ink">{target.name}</h1>
      <p className="text-sm text-ink-muted">@{target.username}</p>

      <div className="mt-6">
        {isSelf ? (
          <p className="text-sm text-ink-muted">This is your own friend link — share it with someone else instead.</p>
        ) : existing?.status === "ACCEPTED" ? (
          <p className="text-sm text-calm">You&apos;re already friends.</p>
        ) : existing && existing.requesterId === user.id ? (
          <p className="text-sm text-ink-muted">Request already sent — waiting for {target.name} to accept.</p>
        ) : existing && existing.requesterId === target.id ? (
          <form action={acceptFriendRequest.bind(null, existing.id)}>
            <button type="submit" className="rounded-lg bg-calm px-5 py-2 text-sm font-medium text-white hover:opacity-90">
              Accept {target.name}&apos;s request
            </button>
          </form>
        ) : (
          <form action={sendFriendRequestToVoid.bind(null, target.id)}>
            <button type="submit" className="rounded-lg bg-calm px-5 py-2 text-sm font-medium text-white hover:opacity-90">
              Add {target.name} as a friend
            </button>
          </form>
        )}
      </div>

      <Link href="/friends" className="mt-6 inline-block text-sm text-ink-muted hover:text-calm">
        ← Back to friends
      </Link>
    </div>
  );
}
