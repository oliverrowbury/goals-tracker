import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE } from "@/lib/auth";
import type { User } from "@/generated/prisma/client";

export const CURRENT_USER_HEADER = "x-proudly-current-user";

// ISO 8601 with milliseconds — exactly what JSON.stringify produces for a
// Date (it calls toISOString() internally), so this is a safe, specific
// enough match to tell "this was a Date" apart from an ordinary string
// field without a hardcoded list of field names to keep in sync.
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// JSON round-trips Date fields as strings — restored here so callers get
// the exact same shape prisma.user.findUnique would have returned. Walks
// every field rather than naming each Date column individually — the
// previous version named only three (createdAt/usernameChangedAt/birthday)
// and silently left every Date column added after it as a plain string on
// the forwarded-header fast path (the common case for every request, see
// getCurrentUser below), which is exactly the kind of bug that's invisible
// until something actually compares or calls a method on the value. The
// header itself is base64 (see proxy.ts for why — header values must be
// plain ASCII, which free-text profile fields aren't guaranteed to be).
function parseForwardedUser(raw: string): User {
  const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  for (const key of Object.keys(parsed)) {
    if (typeof parsed[key] === "string" && ISO_DATETIME_RE.test(parsed[key])) {
      parsed[key] = new Date(parsed[key]);
    }
  }
  return parsed;
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

// The three fields /onboarding collects and won't let through empty —
// checked here (rather than a separate stored flag) so there's one
// definition of "done" that can't drift from what the form actually
// requires. Shared by the proxy's onboarding redirect and the onboarding
// page itself.
export function hasCompletedProfile(user: Pick<User, "birthday" | "gender" | "city">): boolean {
  return !!(user.birthday && user.gender && user.city);
}
