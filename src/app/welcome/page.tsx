import { WelcomeCard } from "./WelcomeCard";

// No metadata export — this is the bare-brand page the root layout's
// title template is meant for (see layout.tsx's own comment), so it falls
// back to the default "Proudly" instead of becoming "Proudly · Proudly".

export default function WelcomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      {/* Ambient glow — same two drifting blobs login/signup already use. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-accent opacity-0 blur-2xl [animation:glow-in_2.2s_ease-out_0.2s_forwards,glow-drift_20s_ease-in-out_infinite_2.4s]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-64 w-64 -translate-x-[65%] -translate-y-[35%] rounded-[45%] bg-calm opacity-0 blur-2xl [animation:glow-in-soft_2.6s_ease-out_0.5s_forwards,glow-drift-reverse_26s_ease-in-out_infinite_3.1s]"
      />

      {/* A faint, oversized echo of the logo's own ascending-bar mark
          (see Wordmark.tsx), sitting behind the card instead of a plain
          background — same bar-grow keyframe the real wordmark uses for
          its own small bars, just scaled way up and barely visible. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-end justify-end gap-3 pr-2 opacity-0 [animation:fade-in_2s_ease-out_0.2s_forwards] sm:gap-5 sm:pr-10"
      >
        <span
          className="w-7 origin-bottom rounded-t-[10px] bg-gradient-to-t from-accent to-accent-strong opacity-[0.07] [animation:bar-grow_1.4s_cubic-bezier(0.16,1,0.3,1)_0.5s_both] sm:w-14"
          style={{ height: "28vh" }}
        />
        <span
          className="w-7 origin-bottom rounded-t-[10px] bg-gradient-to-t from-accent to-accent-strong opacity-[0.07] [animation:bar-grow_1.4s_cubic-bezier(0.16,1,0.3,1)_0.62s_both] sm:w-14"
          style={{ height: "46vh" }}
        />
        <span
          className="w-7 origin-bottom rounded-t-[10px] bg-gradient-to-t from-accent to-accent-strong opacity-[0.07] [animation:bar-grow_1.4s_cubic-bezier(0.16,1,0.3,1)_0.74s_both] sm:w-14"
          style={{ height: "68vh" }}
        />
      </div>

      <WelcomeCard />
    </main>
  );
}
