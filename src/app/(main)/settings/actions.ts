"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { AUTH_COOKIE } from "@/lib/auth";
import { hashPassword, verifyPassword, generateSessionToken } from "@/lib/password";
import { sendPasswordChangedEmail } from "@/lib/email";
import { USERNAME_RE, GENDERS, type Gender, FOCUS_TAGS, type FocusTag } from "@/lib/constants";
import { containsProfanity } from "@/lib/profanity";
import { toKg, toCm } from "@/lib/workout";
import { ageInYears } from "@/lib/dates";
import { uploadAvatarPhoto, deleteAvatarPhoto, deleteJournalPhoto, deleteWorkoutPhoto } from "@/lib/storage";

const MIN_AGE = 13;

export type SettingsActionState = { error?: string; success?: string } | null;

export async function changePassword(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const user = await getCurrentUser();
  const currentOk = await verifyPassword(currentPassword, user.passwordHash);
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

  await sendPasswordChangedEmail(user.email, user.name);

  return { success: "Password changed." };
}

export async function updateName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const user = await getCurrentUser();
  await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/settings");
}

const USERNAME_COOLDOWN_DAYS = 7;
const USERNAME_COOLDOWN_MS = USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export async function updateUsername(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return { error: "3-20 characters, starting with a letter — lowercase letters, numbers, and underscores only." };
  }
  if (containsProfanity(username)) {
    return { error: "That username isn't allowed — please pick another." };
  }

  const user = await getCurrentUser();
  if (username === user.username) return { success: "That's already your username." };

  if (user.usernameChangedAt) {
    const msSinceChange = Date.now() - user.usernameChangedAt.getTime();
    if (msSinceChange < USERNAME_COOLDOWN_MS) {
      const daysLeft = Math.ceil((USERNAME_COOLDOWN_MS - msSinceChange) / (24 * 60 * 60 * 1000));
      return { error: `You can change your username again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.` };
    }
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { error: "That username is taken." };

  await prisma.user.update({ where: { id: user.id }, data: { username, usernameChangedAt: new Date() } });
  revalidatePath("/settings");
  return { success: "Username updated." };
}

export type UnitsActionState = { weightUnit: "KG" | "LB"; distanceUnit: "KM" | "MI" } | null;

export async function updateUnits(_prev: UnitsActionState, formData: FormData): Promise<UnitsActionState> {
  const weightUnit = String(formData.get("weightUnit") ?? "");
  const distanceUnit = String(formData.get("distanceUnit") ?? "");
  if (!["KG", "LB"].includes(weightUnit) || !["KM", "MI"].includes(distanceUnit)) return null;

  const user = await getCurrentUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { weightUnit: weightUnit as "KG" | "LB", distanceUnit: distanceUnit as "KM" | "MI" },
  });
  revalidatePath("/settings");
  revalidatePath("/workout");
  revalidatePath("/");

  return { weightUnit: weightUnit as "KG" | "LB", distanceUnit: distanceUnit as "KM" | "MI" };
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

export async function deleteSubject(subjectId: string) {
  // A goal auto-tracked from this subject falls back to manual logging
  // rather than blocking the delete; study sessions for it go with it —
  // the confirm dialog on the client warns about that before calling this.
  await prisma.$transaction([
    prisma.goal.updateMany({ where: { subjectId }, data: { subjectId: null } }),
    prisma.studySession.deleteMany({ where: { subjectId } }),
    prisma.subject.delete({ where: { id: subjectId } }),
  ]);

  revalidatePath("/settings");
  revalidatePath("/study");
  revalidatePath("/goals");
  revalidatePath("/journal");
  revalidatePath("/");
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

// The three fields /onboarding requires, plus the fully optional ones —
// same validation as completeProfile, but for editing afterward rather
// than the first-time gate.
export async function updateProfile(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const user = await getCurrentUser();

  const birthdayISO = String(formData.get("birthday") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const pronouns = String(formData.get("pronouns") ?? "").trim();
  const weightRaw = String(formData.get("weight") ?? "").trim();
  const heightRaw = String(formData.get("height") ?? "").trim();
  const focusTags = formData.getAll("focusTags").map(String).filter((t): t is FocusTag => FOCUS_TAGS.includes(t as FocusTag));

  if (!birthdayISO) return { error: "Enter your birthday." };
  const birthday = new Date(`${birthdayISO}T00:00:00.000Z`);
  if (Number.isNaN(birthday.getTime()) || birthday.getTime() > Date.now()) {
    return { error: "That doesn't look like a valid birthday." };
  }
  if (ageInYears(birthday) < MIN_AGE) return { error: `You need to be at least ${MIN_AGE} to use Proudly.` };
  if (!GENDERS.includes(gender as Gender)) return { error: "Choose an option for gender." };
  if (!city) return { error: "Enter your city." };

  const weight = weightRaw ? Number(weightRaw) : null;
  const height = heightRaw ? Number(heightRaw) : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      birthday,
      gender: gender as Gender,
      city,
      bio: bio || null,
      pronouns: pronouns || null,
      focusTags,
      weightKg: weight != null && Number.isFinite(weight) && weight > 0 ? toKg(weight, user.weightUnit) : null,
      heightCm: height != null && Number.isFinite(height) && height > 0 ? toCm(height, user.distanceUnit) : null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/friends");
  return { success: "Profile updated." };
}

export async function uploadAvatar(formData: FormData): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first" };
  if (!file.type.startsWith("image/")) return { error: "That's not an image file" };

  if (user.avatarUrl) await deleteAvatarPhoto(user.avatarUrl);

  let avatarUrl: string;
  try {
    avatarUrl = await uploadAvatarPhoto(user.id, file);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }

  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
  revalidatePath("/settings");
  revalidatePath("/friends");
  return null;
}

export async function removeAvatar() {
  const user = await getCurrentUser();
  if (!user.avatarUrl) return;
  await deleteAvatarPhoto(user.avatarUrl);
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
  revalidatePath("/settings");
  revalidatePath("/friends");
}

// Self-service right-to-erasure — deletes every row this account owns, in
// FK-safe order (children before parents), then the account itself. Photos
// live in Supabase Storage, outside Postgres, so they're removed first: a
// transaction rollback wouldn't undo a storage delete anyway, and doing it
// after the DB rows are gone would leave nothing recording which paths to
// clean up. Custom exercises are kept (userId cleared, not deleted) rather
// than removed, since another account's WorkoutSet may still reference one.
export async function deleteAccount(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const password = String(formData.get("password") ?? "");
  const user = await getCurrentUser();
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return { error: "Password is wrong." };

  const [entriesWithPhotos, workoutsWithPhotos, goals, deadlines, workouts] = await Promise.all([
    prisma.journalEntry.findMany({ where: { userId: user.id, photoUrl: { not: null } }, select: { photoUrl: true } }),
    prisma.workout.findMany({ where: { userId: user.id, photoUrl: { not: null } }, select: { photoUrl: true } }),
    prisma.goal.findMany({ where: { userId: user.id }, select: { id: true } }),
    prisma.deadline.findMany({ where: { userId: user.id }, select: { id: true } }),
    prisma.workout.findMany({ where: { userId: user.id }, select: { id: true } }),
  ]);

  await Promise.all([
    ...entriesWithPhotos.map((e) => deleteJournalPhoto(e.photoUrl!)),
    ...workoutsWithPhotos.map((w) => deleteWorkoutPhoto(w.photoUrl!)),
    user.avatarUrl ? deleteAvatarPhoto(user.avatarUrl) : null,
  ]);

  const goalIds = goals.map((g) => g.id);
  const deadlineIds = deadlines.map((d) => d.id);
  const workoutIds = workouts.map((w) => w.id);

  await prisma.$transaction([
    prisma.goalLog.deleteMany({ where: { goalId: { in: goalIds } } }),
    prisma.reminder.deleteMany({ where: { goalId: { in: goalIds } } }),
    prisma.deadlineReminderSent.deleteMany({ where: { deadlineId: { in: deadlineIds } } }),
    prisma.workoutSet.deleteMany({ where: { workoutId: { in: workoutIds } } }),
    prisma.cheer.deleteMany({
      where: { OR: [{ fromUserId: user.id }, { toUserId: user.id }, { workoutId: { in: workoutIds } }] },
    }),
    prisma.follow.deleteMany({ where: { OR: [{ followerId: user.id }, { followingId: user.id }] } }),
    prisma.userBadge.deleteMany({ where: { userId: user.id } }),
    prisma.pushSubscription.deleteMany({ where: { userId: user.id } }),
    prisma.feedback.deleteMany({ where: { userId: user.id } }),
    prisma.journalEntry.deleteMany({ where: { userId: user.id } }),
    prisma.studySession.deleteMany({ where: { userId: user.id } }),
    prisma.workout.deleteMany({ where: { userId: user.id } }),
    prisma.deadline.deleteMany({ where: { userId: user.id } }),
    prisma.goal.deleteMany({ where: { userId: user.id } }),
    prisma.exercise.updateMany({ where: { userId: user.id }, data: { userId: null } }),
    prisma.subject.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);

  redirect("/login");
}

export async function sendFeedback(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: "Write something first." };

  const user = await getCurrentUser();
  await prisma.feedback.create({ data: { userId: user.id, message } });
  revalidatePath("/settings");

  return { success: "Thanks — feedback sent." };
}
