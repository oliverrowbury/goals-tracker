import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE } from "@/lib/auth";

// Resolves the signed-in account from the session cookie — every table is
// already scoped by user_id (see prisma/schema.prisma), so this is the one
// place multi-user auth actually lives. The proxy already redirects to
// /login when there's no valid session on any protected route, so by the
// time a server component/action calls this, a valid session should exist;
// throwing here surfaces a real bug rather than silently falling back to
// "whichever account happens to be first in the table."
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) throw new Error("Not signed in");

  return prisma.user.findUniqueOrThrow({ where: { sessionToken: token } });
}

// Same lookup as getCurrentUser, but returns null instead of throwing when
// there's no session — for the root layout, which also renders signed-out
// pages (/login, /signup) and just needs "is someone logged in, and if so
// what's their accent theme" rather than a hard requirement.
export async function getOptionalUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  return prisma.user.findUnique({ where: { sessionToken: token } });
}
