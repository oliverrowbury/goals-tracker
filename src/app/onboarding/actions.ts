"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { toKg, toCm } from "@/lib/workout";
import { ageInYears } from "@/lib/dates";
import { GENDERS, type Gender } from "@/lib/constants";

export type OnboardingState = { error: string } | null;

const MIN_AGE = 13;

export async function completeProfile(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await getCurrentUser();

  const birthdayISO = String(formData.get("birthday") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const pronouns = String(formData.get("pronouns") ?? "").trim();
  const weightRaw = String(formData.get("weight") ?? "").trim();
  const heightRaw = String(formData.get("height") ?? "").trim();

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
      weightKg: weight != null && Number.isFinite(weight) && weight > 0 ? toKg(weight, user.weightUnit) : null,
      heightCm: height != null && Number.isFinite(height) && height > 0 ? toCm(height, user.distanceUnit) : null,
    },
  });

  redirect("/");
}
