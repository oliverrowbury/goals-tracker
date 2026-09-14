"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateSessionToken } from "@/lib/password";
import { sendWelcomeEmail } from "@/lib/email";

export type SignupState = {
  fieldErrors: { name?: string; email?: string; password?: string; confirmPassword?: string };
  // Whatever was typed for name/email, so the fields can be re-populated —
  // React resets every uncontrolled field in a <form> to its defaultValue
  // once the action finishes (success or not), so without threading these
  // back through as the new defaultValue, a single bad field would wipe
  // the other, perfectly fine ones too. Passwords are deliberately not
  // echoed back — same convention as re-typing a password on any error.
  values: { name: string; email: string };
} | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const values = { name, email };

  const fieldErrors: NonNullable<SignupState>["fieldErrors"] = {};
  if (!name) fieldErrors.name = "Enter your name.";
  if (!email) fieldErrors.email = "Enter your email.";
  else if (!EMAIL_RE.test(email)) fieldErrors.email = "That doesn't look like a valid email address.";
  if (password.length < 6) fieldErrors.password = "Needs to be at least 6 characters.";
  if (confirmPassword !== password) fieldErrors.confirmPassword = "Doesn't match your password.";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { fieldErrors: { email: "That email already has an account — sign in instead." }, values };

  const passwordHash = await hashPassword(password);
  const sessionToken = generateSessionToken();
  await prisma.user.create({ data: { name, email, passwordHash, sessionToken } });

  // Awaited (not fire-and-forget) — on a serverless host the function can
  // be frozen as soon as the response goes out, which for a redirect is
  // right after this action returns, so a dangling un-awaited send can get
  // cut off before it actually reaches Resend.
  await sendWelcomeEmail(email, name);

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  redirect("/");
}
