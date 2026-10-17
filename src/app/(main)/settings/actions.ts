"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { AUTH_COOKIE } from "@/lib/auth";
import { hashPassword, verifyPassword, generateSessionToken } from "@/lib/password";
import { sendPasswordChangedEmail, sendEmailChangedEmail } from "@/lib/email";
import { USERNAME_RE, EMAIL_RE, GENDERS, type Gender, FOCUS_TAGS, type FocusTag } from "@/lib/constants";
import { containsProfanity } from "@/lib/profanity";
import { toKg, toCm } from "@/lib/workout";
import { ageInYears } from "@/lib/dates";
import { uploadAvatarPhoto, deleteAvatarPhoto, deleteJournalPhoto, deleteWorkoutPhoto } from "@/lib/storage";
import { ADMIN_EMAIL } from "@/lib/auth";
import { awardBadge } from "@/lib/badges";
import type Stripe from "stripe";
import { getStripe, PREMIUM_PRICING, type PremiumInterval } from "@/lib/stripe";
import { restoreTrashedItem } from "@/lib/trash";

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
  if (!name || name.split(/\s+/).length < 2) return;

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
    return { error: "3-20 characters, starting with a letter, lowercase letters, numbers, and underscores only." };
  }
  if (containsProfanity(username)) {
    return { error: "That username isn't allowed, please pick another." };
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

// Requires the current password, same bar as deleteAccount — email is the
// login identifier and the target of "forgot password," so changing it is
// a security-relevant action, not a cosmetic profile field like name/bio.
export async function updateEmail(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!EMAIL_RE.test(email)) return { error: "That doesn't look like a valid email address." };

  const user = await getCurrentUser();
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return { error: "Password is wrong." };

  if (email === user.email) return { success: "That's already your email." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "That email is already in use." };

  // The new address hasn't been verified — reset the flag rather than
  // carrying over whatever the old address's status was. No new
  // verification email is sent here: Resend's sandbox sender can't
  // actually deliver to an arbitrary new address yet (see the "verify
  // your email" nag's own paused comment in (main)/layout.tsx), so
  // sending one here would just silently go nowhere.
  await prisma.user.update({ where: { id: user.id }, data: { email, emailVerifiedAt: null } });
  await sendEmailChangedEmail(user.email, user.name, email);

  revalidatePath("/settings");
  return { success: "Email updated." };
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

  const user = await getCurrentUser();
  await prisma.subject.updateMany({ where: { id: subjectId, userId: user.id }, data: { name } });
  revalidatePath("/settings");
  revalidatePath("/study");
}

export async function deleteSubject(subjectId: string) {
  const user = await getCurrentUser();
  // Ownership check first — without it, any logged-in user could wipe
  // another user's entire study-session history for a subject just by
  // knowing its id, not only their own.
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId: user.id } });
  if (!subject) return;

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
  const user = await getCurrentUser();
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
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

  // Upload the new photo before deleting the old one — uploadAvatarPhoto's
  // path is always unique (Date.now()-suffixed), so there's no collision
  // risk, and a failed/flaky upload no longer leaves the user with no
  // photo at all while the DB still points at whatever was just deleted.
  let avatarUrl: string;
  try {
    avatarUrl = await uploadAvatarPhoto(user.id, file);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }

  if (user.avatarUrl) await deleteAvatarPhoto(user.avatarUrl).catch(() => {});

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
    // Comment.authorId and Message.senderId/recipientId are real (RESTRICT)
    // foreign keys, unlike Cheer/Comment's workoutId/studySessionId columns
    // — without deleting these first, prisma.user.delete below fails outright
    // for anyone who's ever commented or messaged.
    prisma.comment.deleteMany({ where: { authorId: user.id } }),
    prisma.message.deleteMany({ where: { OR: [{ senderId: user.id }, { recipientId: user.id }] } }),
    // Same RESTRICT-foreign-key reasoning as Comment/Message above.
    prisma.block.deleteMany({ where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] } }),
    prisma.report.deleteMany({ where: { OR: [{ reporterId: user.id }, { targetUserId: user.id }] } }),
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

const MAX_FEEDBACK_LENGTH = 2000;

export async function sendFeedback(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: "Write something first." };
  if (message.length > MAX_FEEDBACK_LENGTH) return { error: `Keep it under ${MAX_FEEDBACK_LENGTH} characters.` };

  const user = await getCurrentUser();
  await prisma.feedback.create({ data: { userId: user.id, message } });
  revalidatePath("/settings");

  return { success: "Thanks, feedback sent." };
}

// Admin override, independent of Stripe — comped every account that
// existed before Premium/Stripe launched, and stays for support/goodwill
// cases (e.g. a refund handled outside Stripe). Admin-only, same
// ADMIN_EMAIL gate the Users list itself is already shown behind. Doesn't
// touch stripeSubscriptionId — toggling a Stripe subscriber off here
// doesn't cancel their actual subscription, so the next renewal webhook
// would just turn isPremium back on. Not a substitute for cancelling via
// the billing portal.
export async function toggleUserPremium(targetUserId: string) {
  const admin = await getCurrentUser();
  if (admin.email !== ADMIN_EMAIL) return;

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { isPremium: true } });
  if (!target) return;

  const nextIsPremium = !target.isPremium;
  await prisma.user.update({ where: { id: targetUserId }, data: { isPremium: nextIsPremium } });
  if (nextIsPremium) await awardBadge(targetUserId, "PREMIUM_SUPPORTER");

  revalidatePath("/settings");
}

// Absolute origin for Stripe's success_url/cancel_url/return_url, which
// can't be relative — derived from the request rather than a hardcoded
// env var, so it's automatically correct on every Vercel preview/
// production URL and in local dev alike.
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type CreateCheckoutState = { error: string } | null;

// Starts a Stripe Checkout session for a new Premium subscription.
// price_data (inline) rather than a pre-created Stripe Price object —
// one less thing to configure in the Stripe dashboard, and the price
// lives in one place (lib/stripe.ts's PREMIUM_PRICING) instead of two.
export async function createCheckoutSession(interval: PremiumInterval): Promise<CreateCheckoutState> {
  const user = await getCurrentUser();
  if (user.isPremium) return { error: "You already have Premium." };

  const origin = await siteOrigin();
  const pricing = PREMIUM_PRICING[interval];

  let session;
  try {
    const stripe = getStripe();
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: user.stripeCustomerId ?? undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      client_reference_id: user.id,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: `Proudly Premium (${interval === "month" ? "monthly" : "yearly"})` },
            unit_amount: pricing.amountPence,
            recurring: { interval },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/settings?premium=success#premium`,
      cancel_url: `${origin}/settings#premium`,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
      // Stripe's newer "Managed Payments" (on by default for new accounts)
      // requires every line item's product to carry a tax code, which these
      // inline price_data items never do — without this, checkout fails
      // outright with "the product tax code is missing". Not in the
      // installed SDK's types yet, hence the cast; the API itself accepts it.
      ...({ managed_payments: { enabled: false } } as Partial<Stripe.Checkout.SessionCreateParams>),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't start checkout — try again in a moment." };
  }

  if (!session.url) return { error: "Couldn't start checkout — try again in a moment." };
  redirect(session.url);
}

export type BillingPortalState = { error: string } | null;

// Stripe's hosted billing portal — lets a real subscriber update their
// card, see invoices, or cancel, without any of that needing building or
// maintaining here. Only meaningful for someone with an actual Stripe
// subscription; an admin-comped user has nothing there to manage.
export async function createBillingPortalSession(): Promise<BillingPortalState> {
  const user = await getCurrentUser();
  if (!user.stripeCustomerId) return { error: "No subscription to manage." };

  const origin = await siteOrigin();
  let session;
  try {
    session = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/settings#premium`,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't open billing portal — try again in a moment." };
  }

  redirect(session.url);
}

export async function restoreDeletedItem(trashedItemId: string) {
  const user = await getCurrentUser();
  if (!user.isPremium) return;

  await restoreTrashedItem(user.id, trashedItemId);

  revalidatePath("/settings");
  revalidatePath("/goals");
  revalidatePath("/workout");
  revalidatePath("/journal");
  revalidatePath("/");
}
