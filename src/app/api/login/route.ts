import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateSessionToken } from "@/lib/password";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");
  const from = typeof form.get("from") === "string" ? (form.get("from") as string) : "/";

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  // Always run verifyPassword, even for an email that doesn't exist or an
  // account with no password set — comparing against a dummy hash of the
  // right shape keeps the response time the same either way, so a wrong
  // password and an unknown email can't be told apart by how long login
  // takes (a classic user-enumeration side channel).
  const DUMMY_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "1");
    url.searchParams.set("from", from);
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
  return response;
}
