import { redirect } from "next/navigation";
import { getCurrentUser, hasCompletedProfile } from "@/lib/user";
import { Wordmark } from "@/components/Wordmark";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  // Already done — nothing here for a completed profile to look at, and
  // the proxy only sends people here in the first place while it's missing.
  if (hasCompletedProfile(user)) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm animate-[fade-up_0.5s_ease-out_both] rounded-2xl border border-line bg-card p-7 shadow-lg">
        <h1 className="mb-1 text-3xl text-ink">
          <Wordmark />
        </h1>
        <p className="mb-6 text-sm text-ink-muted">
          A few last things before you&apos;re in — birthday, gender, and city are required; the rest is up to you.
        </p>
        <OnboardingForm weightUnit={user.weightUnit} distanceUnit={user.distanceUnit} />

        <form action="/api/logout" method="POST" className="mt-4 text-center">
          <button type="submit" className="text-sm text-ink-muted hover:text-accent">
            Signed up by mistake? Log out
          </button>
        </form>
      </div>
    </main>
  );
}
