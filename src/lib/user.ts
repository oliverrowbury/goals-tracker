import { prisma } from "@/lib/prisma";

// Single-user app for now (see prisma/seed.ts) — every query is scoped by
// user_id already, so swapping this for real multi-user auth later doesn't
// touch any of the query code, just this one function.
export async function getCurrentUser() {
  return prisma.user.findFirstOrThrow();
}
