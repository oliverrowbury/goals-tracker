import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { UsersIcon } from "@/components/Icons";
import { followUserVoid, unfollowUser } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AddFriendByLinkPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await getCurrentUser();
  const target = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!target) notFound();

  const isSelf = target.id === user.id;
  const alreadyFollowing = isSelf
    ? false
    : (await prisma.follow.findFirst({ where: { followerId: user.id, followingId: target.id } })) != null;

  return (
    <div className="mx-auto max-w-sm text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-calm-soft text-calm">
        <UsersIcon className="h-7 w-7" />
      </span>
      <h1 className="mt-4 font-serif text-2xl font-semibold text-ink">{target.name}</h1>
      <p className="text-sm text-ink-muted">@{target.username}</p>

      <div className="mt-6">
        {isSelf ? (
          <p className="text-sm text-ink-muted">This is your own share link — send it to someone else instead.</p>
        ) : alreadyFollowing ? (
          <form action={unfollowUser.bind(null, target.id)}>
            <p className="mb-2 text-sm text-calm">You&apos;re following {target.name}.</p>
            <button type="submit" className="text-sm text-ink-muted hover:text-accent">
              Unfollow
            </button>
          </form>
        ) : (
          <form action={followUserVoid.bind(null, target.id)}>
            <button type="submit" className="rounded-lg bg-calm px-5 py-2 text-sm font-medium text-white hover:opacity-90">
              Follow {target.name}
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
