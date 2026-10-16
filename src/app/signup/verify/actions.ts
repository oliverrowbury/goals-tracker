"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateVerificationCode } from "@/lib/password";
import { sendVerificationCodeEmail } from "@/lib/email";
import { MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS, VERIFY_CODE_TTL_MS } from "@/lib/auth";

export type VerifyCodeState = { error?: string } | null;

export async function verifyEmailCode(email: string, _prev: VerifyCodeState, formData: FormData): Promise<VerifyCodeState> {
  const code = String(formData.get("code") ?? "").trim();
  const user = await prisma.user.findUnique({ where: { email } });

  // Same "don't tell a guesser which half they got wrong" shape as login —
  // an unknown email, an already-verified account, or a genuinely wrong
  // code all just read as "that's not right" to whoever's typing.
  if (!user || user.emailVerifiedAt) {
    return { error: "That code's wrong or expired. Request a new one below." };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "Too many wrong codes. Try again in a few minutes, or request a new one." };
  }

  const valid = !!code && user.verifyToken === code && !!user.verifyTokenExpiresAt && user.verifyTokenExpiresAt > new Date();

  if (!valid) {
    // Same atomic-increment reasoning as /api/login — a parallelized
    // guessing script hitting this at once shouldn't be able to under-count
    // by racing a read-then-write.
    const { failedLoginAttempts } = await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) } });
    }
    return { error: "That code's wrong or expired. Request a new one below." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), verifyToken: null, verifyTokenExpiresAt: null, failedLoginAttempts: 0, lockedUntil: null },
  });

  redirect("/login?verified=1");
}

export type ResendState = { sent: boolean; cooldown?: boolean } | null;

// At most one resend per minute, same trick as forgot-password's own
// cooldown — reusing verifyTokenExpiresAt rather than a new column: a code
// this far from expiring could only have been issued within the last
// RESEND_COOLDOWN_MS.
const RESEND_COOLDOWN_MS = 60 * 1000;

export async function resendVerificationCode(email: string): Promise<ResendState> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt) return { sent: true };

  const recentlySent = user.verifyTokenExpiresAt && user.verifyTokenExpiresAt.getTime() > Date.now() + VERIFY_CODE_TTL_MS - RESEND_COOLDOWN_MS;
  if (recentlySent) return { sent: false, cooldown: true };

  const code = generateVerificationCode();
  await prisma.user.update({
    where: { id: user.id },
    data: { verifyToken: code, verifyTokenExpiresAt: new Date(Date.now() + VERIFY_CODE_TTL_MS), failedLoginAttempts: 0, lockedUntil: null },
  });
  await sendVerificationCodeEmail(user.email, user.name, code);

  return { sent: true };
}
