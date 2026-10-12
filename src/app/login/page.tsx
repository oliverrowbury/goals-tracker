import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { error, created } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Ambient glow — the one bit of continuous motion on this page,
          same "always something quietly alive" idea as the breathing
          exercise's halo. Two blobs drifting at different speeds/phases
          for a little parallax depth, rather than one flat glow. Purely
          decorative (aria-hidden), sits behind the card via z-index, not
          interactive. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-accent opacity-0 blur-2xl [animation:glow-in_2.2s_ease-out_0.2s_forwards,glow-drift_20s_ease-in-out_infinite_2.4s]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-64 w-64 -translate-x-[65%] -translate-y-[35%] rounded-[45%] bg-calm opacity-0 blur-2xl [animation:glow-in-soft_2.6s_ease-out_0.5s_forwards,glow-drift-reverse_26s_ease-in-out_infinite_3.1s]"
      />

      <LoginForm error={error} created={!!created} />

      <p className="fixed inset-x-0 bottom-4 text-center text-xs text-ink-muted">
        <Link href="/privacy" className="hover:text-accent hover:underline">
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/terms" className="hover:text-accent hover:underline">
          Terms of Service
        </Link>
      </p>
    </main>
  );
}
