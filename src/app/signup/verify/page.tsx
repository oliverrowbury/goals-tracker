import { redirect } from "next/navigation";
import { VerifyCodeForm } from "./VerifyCodeForm";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  // No email in the URL means this wasn't reached from signup just now —
  // nothing useful to show, so send them back to start properly rather
  // than rendering a code form with nowhere to send the code.
  if (!email) redirect("/signup");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-accent opacity-0 blur-2xl [animation:glow-in_2.2s_ease-out_0.2s_forwards,glow-drift_20s_ease-in-out_infinite_2.4s]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-64 w-64 -translate-x-[65%] -translate-y-[35%] rounded-[45%] bg-calm opacity-0 blur-2xl [animation:glow-in-soft_2.6s_ease-out_0.5s_forwards,glow-drift-reverse_26s_ease-in-out_infinite_3.1s]"
      />
      <VerifyCodeForm email={email} />
    </main>
  );
}
