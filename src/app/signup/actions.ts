"use server";

import { redirect } from "next/navigation";
import { baseUrl } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateSessionToken } from "@/lib/password";
import { sendWelcomeEmail, sendVerificationEmail } from "@/lib/email";
import { USERNAME_RE, EMAIL_RE } from "@/lib/constants";
import { containsProfanity } from "@/lib/profanity";

const VERIFY_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export type SignupState = {
  fieldErrors: {
    name?: string;
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    agreeToTerms?: string;
  };
  // Whatever was typed for name/username/email, so the fields can be
  // re-populated — React resets every uncontrolled field in a <form> to
  // its defaultValue once the action finishes (success or not), so
  // without threading these back through as the new defaultValue, a
  // single bad field would wipe the other, perfectly fine ones too.
  // Passwords are deliberately not echoed back — same convention as
  // re-typing a password on any error.
  values: { name: string; username: string; email: string };
} | null;

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const agreeToTerms = formData.get("agreeToTerms") === "on";
  const values = { name, username, email };

  const fieldErrors: NonNullable<SignupState>["fieldErrors"] = {};
  if (!name) fieldErrors.name = "Enter your name.";
  else if (name.split(/\s+/).length < 2) fieldErrors.name = "Enter your first and last name.";
  if (!username) fieldErrors.username = "Choose a username.";
  else if (!USERNAME_RE.test(username)) {
    fieldErrors.username = "3-20 characters, starting with a letter, lowercase letters, numbers, and underscores only.";
  } else if (containsProfanity(username)) {
    fieldErrors.username = "That username isn't allowed, please pick another.";
  }
  if (!email) fieldErrors.email = "Enter your email.";
  else if (!EMAIL_RE.test(email)) fieldErrors.email = "That doesn't look like a valid email address.";
  if (password.length < 6) fieldErrors.password = "Needs to be at least 6 characters.";
  if (confirmPassword !== password) fieldErrors.confirmPassword = "Doesn't match your password.";
  if (!agreeToTerms) fieldErrors.agreeToTerms = "You need to agree to the Terms and Privacy Policy to continue.";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { username } }),
  ]);
  if (existingEmail) return { fieldErrors: { email: "That email already has an account, sign in instead." }, values };
  if (existingUsername) return { fieldErrors: { username: "That username is taken." }, values };

  const passwordHash = await hashPassword(password);
  const verifyToken = generateSessionToken();
  const verifyTokenExpiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  try {
    await prisma.user.create({
      data: { name, username, email, passwordHash, verifyToken, verifyTokenExpiresAt },
    });
  } catch (err) {
    // The findUnique checks above can't fully close this — two concurrent
    // signups for the same email/username (a double-submit, or two tabs)
    // can both pass them and race on create. Without this, the loser hit
    // an uncaught unique-constraint error and landed on the generic error
    // page, losing their whole typed-out form instead of the same friendly
    // message the pre-check gives everyone else.
    //
    // meta.target isn't populated under this project's driver-adapter
    // (@prisma/adapter-pg) setup — confirmed empirically, not assumed —
    // so the conflicting field is parsed out of the error message instead,
    // e.g. "Unique constraint failed on the fields: (`email`)".
    const e = err as { code?: string; message?: string; meta?: { target?: string[] } };
    const field = e?.meta?.target?.[0] ?? e?.message?.match(/fields: \(`(\w+)`\)/)?.[1];
    if (e?.code === "P2002" && field === "email") {
      return { fieldErrors: { email: "That email already has an account, sign in instead." }, values };
    }
    if (e?.code === "P2002" && field === "username") {
      return { fieldErrors: { username: "That username is taken." }, values };
    }
    throw err;
  }

  // Awaited (not fire-and-forget) — on a serverless host the function can
  // be frozen as soon as the response goes out, which for a redirect is
  // right after this action returns, so a dangling un-awaited send can get
  // cut off before it actually reaches Resend.
  await sendWelcomeEmail(email, name);
  await sendVerificationEmail(email, name, `${await baseUrl()}/api/verify-email?token=${verifyToken}`);

  // Sign in on purpose, not automatically — landing back on /login after
  // creating the account means the password they just typed is the first
  // thing that actually gets verified, same as any other account they sign
  // up for elsewhere.
  redirect("/login?created=1");
}
