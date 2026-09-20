"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE } from "@/lib/auth";
import { hashPassword, generateSessionToken } from "@/lib/password";
import { sendPasswordChangedEmail } from "@/lib/email";

export type ResetPasswordState = { error?: string } | null;

export async function resetPassword(_prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) return { error: "That reset link is invalid — request a new one." };
  if (password.length < 6) return { error: "Needs to be at least 6 characters." };
  if (password !== confirmPassword) return { error: "Passwords don't match." };

  const user = await prisma.user.findUnique({ where: { resetToken: token } });
  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    return { error: "That reset link is invalid or has expired — request a new one." };
  }

  const passwordHash = await hashPassword(password);
  // Regenerating sessionToken invalidates any session logged in elsewhere
  // — same as settings/actions.ts's changePassword — and signs this
  // browser straight in with the fresh one rather than bouncing back to
  // a login form right after they just proved they own the account.
  const sessionToken = generateSessionToken();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      sessionToken,
      resetToken: null,
      resetTokenExpiresAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await sendPasswordChangedEmail(user.email, user.name);

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
