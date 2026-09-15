import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE } from "@/lib/auth";
import type { User } from "@/generated/prisma/client";

export const CURRENT_USER_HEADER = "x-proudly-current-user";

// JSON round-trips Date fields as strings — restored here so callers get
// the exact same shape prisma.user.findUnique would have returned.
function parseForwardedUser(raw: string): User {
  const parsed = JSON.parse(raw);
  return {
    ...parsed,
    createdAt: new Date(parsed.createdAt),
    usernameChangedAt: parsed.usernameChangedAt ? new Date(parsed.usernameChangedAt) : null,
  };
}

// Resolves the signed-in account from the session cookie — every table is
// already scoped by user_id (see prisma/schema.prisma), so this is the one
// place multi-user auth actually lives. The proxy already looked this same
// row up (to decide whether to redirect to /login) and forwards it via
// CURRENT_USER_HEADER, so the common case here is reading that instead of
// querying the database a second time for every single request. Falling
// back to a real lookup keeps this function correct on its own (e.g. if
// ever called somewhere the proxy's matcher doesn't cover) rather than
// silently trusting an absent header.
export async function getCurrentUser(): Promise<User> {
  const headerStore = await headers();
  const forwarded = headerStore.get(CURRENT_USER_HEADER);
  if (forwarded) return parseForwardedUser(forwarded);

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) throw new Error("Not signed in");

  return prisma.user.findUniqueOrThrow({ where: { sessionToken: token } });
}
