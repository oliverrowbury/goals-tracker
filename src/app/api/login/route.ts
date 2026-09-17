import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, LOGIN_REDIRECT_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateSessionToken } from "@/lib/password";

// Only ever redirects to a same-origin, path-only destination — the cookie
// is set by our own proxy.ts to a bare pathname (see LOGIN_REDIRECT_COOKIE's
// comment in lib/auth.ts), never to a full URL, so there's nothing here an
// attacker could point at another origin even if the cookie were tampered
// with some other way.
function safeRedirectPath(path: string | undefined): string {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  const cookieStore = await cookies();
  const from = safeRedirectPath(cookieStore.get(LOGIN_REDIRECT_COOKIE)?.value);

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  // Always run verifyPassword, even for an email that doesn't exist or an
  // account with no password set — comparing against a dummy hash of the
  // right shape keeps the response time the same either way, so a wrong
  // password and an unknown email can't be told apart by how long login
  // takes (a classic user-enumeration side channel).
  const DUMMY_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    // The redirect-target cookie is left as-is (not cleared) so a retry
    // after a typo still lands back where the user was trying to go.
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, { status: 303 });
  }

  const token = generateSessionToken();
  await prisma.user.update({ where: { id: user.id }, data: { sessionToken: token } });

  const response = NextResponse.redirect(new URL(from, request.url), { status: 303 });
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  // Used once — clearing it means a plain "open the app" login later (no
  // prior redirect-from-a-protected-page) correctly lands on "/" instead of
  // replaying wherever an earlier redirect happened to point.
  response.cookies.delete(LOGIN_REDIRECT_COOKIE);
  return response;
}
