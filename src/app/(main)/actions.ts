"use server";

import { baseUrl } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { generateSessionToken } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/email";

const VERIFY_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

// Re-sends the same link signup already sent — for whoever missed the
// first one or waited past its 48-hour expiry. Regenerates the token
// either way, so an old copy of the email stops working the moment a new
// one's requested.
export async function resendVerificationEmail() {
  const user = await getCurrentUser();
  if (user.emailVerifiedAt) return;

  const verifyToken = generateSessionToken();
  const verifyTokenExpiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  await prisma.user.update({ where: { id: user.id }, data: { verifyToken, verifyTokenExpiresAt } });

  await sendVerificationEmail(user.email, user.name, `${await baseUrl()}/api/verify-email?token=${verifyToken}`);
}
