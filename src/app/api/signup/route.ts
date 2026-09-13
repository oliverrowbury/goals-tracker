import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateSessionToken } from "@/lib/password";

function redirectWithError(request: Request, error: string) {
  const url = new URL("/signup", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");

  if (!name || !email) return redirectWithError(request, "1");
  if (password.length < 6) return redirectWithError(request, "short");
  if (password !== confirmPassword) return redirectWithError(request, "mismatch");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return redirectWithError(request, "taken");

  const passwordHash = await hashPassword(password);
  const sessionToken = generateSessionToken();
  await prisma.user.create({
    data: { name, email, passwordHash, sessionToken },
  });

  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  response.cookies.set(AUTH_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
