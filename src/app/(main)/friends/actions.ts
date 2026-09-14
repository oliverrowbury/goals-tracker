"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

export type FriendRequestState = { error?: string; success?: string } | null;

export async function sendFriendRequest(_prev: FriendRequestState, formData: FormData): Promise<FriendRequestState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Enter an email address" };

  const user = await getCurrentUser();
  if (email === user.email.toLowerCase()) return { error: "That's your own email" };

  const other = await prisma.user.findUnique({ where: { email } });
  if (!other) return { error: "No Proudly account with that email" };

  // One row per pair regardless of direction — check both orderings.
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: other.id },
        { requesterId: other.id, addresseeId: user.id },
      ],
    },
  });

  if (existing?.status === "ACCEPTED") return { error: `You're already friends with ${other.name}` };

  if (existing && existing.requesterId === user.id) {
    return { error: `You've already sent ${other.name} a request` };
  }

  if (existing && existing.requesterId === other.id) {
    // They already requested you — this is a mutual add, accept it
    // outright instead of leaving two crossed pending requests.
    await prisma.friendship.update({ where: { id: existing.id }, data: { status: "ACCEPTED" } });
    revalidatePath("/friends");
    return { success: `You and ${other.name} are now friends` };
  }

  await prisma.friendship.create({ data: { requesterId: user.id, addresseeId: other.id } });
  revalidatePath("/friends");
  return { success: `Request sent to ${other.name}` };
}

export async function acceptFriendRequest(friendshipId: string) {
  const user = await getCurrentUser();
  // findFirst (not findUniqueOrThrow) so a request meant for someone else
  // just no-ops instead of accepting on their behalf.
  const request = await prisma.friendship.findFirst({ where: { id: friendshipId, addresseeId: user.id } });
  if (!request) return;

  await prisma.friendship.update({ where: { id: friendshipId }, data: { status: "ACCEPTED" } });
  revalidatePath("/friends");
}

// Covers declining a pending request, cancelling one you sent, and
// removing an existing friend — all the same "this row shouldn't exist
// anymore" operation, just at different statuses.
export async function removeFriendship(friendshipId: string) {
  const user = await getCurrentUser();
  await prisma.friendship.deleteMany({
    where: { id: friendshipId, OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
  });
  revalidatePath("/friends");
}

export async function setShareActivity(share: boolean) {
  const user = await getCurrentUser();
  await prisma.user.update({ where: { id: user.id }, data: { shareActivity: share } });
  revalidatePath("/friends");
}
