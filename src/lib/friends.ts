import { prisma } from "@/lib/prisma";

// Messaging's permission bar is stricter than Follow's own one-directional
// model — both sides have to have an accepted follow on the other, not just
// one. Shared by the messages pages (access control) and the send action
// (defense in depth) so the rule only lives in one place.
export async function isMutualFollow(aId: string, bId: string): Promise<boolean> {
  const [aFollowsB, bFollowsA] = await Promise.all([
    prisma.follow.findFirst({ where: { followerId: aId, followingId: bId, status: "ACCEPTED" } }),
    prisma.follow.findFirst({ where: { followerId: bId, followingId: aId, status: "ACCEPTED" } }),
  ]);
  return !!aFollowsB && !!bFollowsA;
}
