import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateSessionToken } from "@/lib/password";
import { getCurrentUser } from "@/lib/user";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const from = typeof form.get("from") === "string" ? (form.get("from") as string) : "/";

  const user = await getCurrentUser();
  // No password set in the DB yet (fresh install) — fall back to the env
  // var until the first change via Settings sets a real hash.
  const valid = user.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : password === process.env.APP_PASSWORD;

  if (!valid) {
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
