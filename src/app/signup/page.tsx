import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Same ambient glow as login, for consistency across both entry
          points into the app. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-accent opacity-0 blur-2xl [animation:glow-in_2.2s_ease-out_0.2s_forwards,glow-drift_20s_ease-in-out_infinite_2.4s]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-64 w-64 -translate-x-[65%] -translate-y-[35%] rounded-[45%] bg-calm opacity-0 blur-2xl [animation:glow-in-soft_2.6s_ease-out_0.5s_forwards,glow-drift-reverse_26s_ease-in-out_infinite_3.1s]"
      />
      <SignupForm />
    </main>
  );
}
