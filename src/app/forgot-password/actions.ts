"use server";

import { prisma } from "@/lib/prisma";
import { baseUrl } from "@/lib/auth";
import { generateSessionToken } from "@/lib/password";
import { sendPasswordResetEmail } from "@/lib/email";

export type ForgotPasswordState = { submitted: boolean } | null;

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_COOLDOWN_MS = 60 * 1000; // at most one reset email per minute

// Always returns the same { submitted: true } regardless of whether the
// email actually has an account — telling the two apart is exactly the
// user-enumeration side channel api/login/route.ts already avoids for
// login itself.
export async function requestPasswordReset(_prev: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    // Unlike messages/comments, there's no logged-in userId to throttle by
    // here — this runs before login. Reusing resetTokenExpiresAt as a
    // cooldown marker avoids a schema change: a token this far from
    // expiring could only have been issued within the last
    // RESET_COOLDOWN_MS, so skip re-sending (same user-enumeration-safe
    // response either way) rather than letting the form be spammed to
    // flood someone's real inbox with genuine reset emails.
    const recentlySent =
      user?.resetTokenExpiresAt && user.resetTokenExpiresAt.getTime() > Date.now() + RESET_TOKEN_TTL_MS - RESET_COOLDOWN_MS;
    if (user && !recentlySent) {
      const resetToken = generateSessionToken();
      const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await prisma.user.update({ where: { id: user.id }, data: { resetToken, resetTokenExpiresAt } });

      const url = `${await baseUrl()}/reset-password?token=${resetToken}`;
      await sendPasswordResetEmail(user.email, user.name, url);
    }
  }

  return { submitted: true };
}
