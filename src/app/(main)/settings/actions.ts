"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { AUTH_COOKIE } from "@/lib/auth";
import { hashPassword, verifyPassword, generateSessionToken } from "@/lib/password";

export type SettingsActionState = { error?: string; success?: string } | null;

export async function changePassword(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const user = await getCurrentUser();
  const currentOk = user.passwordHash
    ? await verifyPassword(currentPassword, user.passwordHash)
    : currentPassword === process.env.APP_PASSWORD;
  if (!currentOk) return { error: "Current password is wrong." };

  if (newPassword.length < 6) return { error: "New password needs to be at least 6 characters." };
  if (newPassword !== confirmPassword) return { error: "New password and confirmation don't match." };

  const passwordHash = await hashPassword(newPassword);
  const sessionToken = generateSessionToken(); // regenerating invalidates any other logged-in session

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash, sessionToken } });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return { success: "Password changed." };
}

export async function updateName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const user = await getCurrentUser();
  await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/settings");
}

export async function renameSubject(subjectId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.subject.update({ where: { id: subjectId }, data: { name } });
  revalidatePath("/settings");
  revalidatePath("/study");
}

export async function setSubjectActive(subjectId: string, active: boolean) {
  await prisma.subject.update({ where: { id: subjectId }, data: { active } });
  revalidatePath("/settings");
  revalidatePath("/study");
}

export async function updateReminder(formData: FormData) {
  const enabled = formData.get("reminderEnabled") === "on";
  const time = String(formData.get("reminderTime") ?? "").trim();

  const user = await getCurrentUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { reminderEnabled: enabled && !!time, reminderTime: time || null },
  });
  revalidatePath("/settings");
}

export async function savePushSubscription(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const user = await getCurrentUser();
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userId: user.id },
    create: {
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

export async function removePushSubscription(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}
