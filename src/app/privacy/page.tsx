import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export const metadata = { title: "Privacy Policy — Proudly" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-xl text-ink">
        <Wordmark />
      </Link>

      <h1 className="mt-8 font-serif text-2xl font-semibold text-ink">Privacy Policy</h1>
      <p className="mt-1 text-sm text-ink-muted">Last updated 10 September 2026.</p>

      <div className="prose-sm mt-6 space-y-5 text-sm leading-relaxed text-ink">
        <p>
          Proudly is a personal journaling, goals, and study-tracking app. This page explains what data it collects,
          why, and what you can do about it.
        </p>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Account details: your email and name, and a securely hashed password (never the password itself).</li>
            <li>
              What you write: journal entries, mood check-ins, prompt answers, and any photos you choose to attach to
              an entry.
            </li>
            <li>Goals you set and your progress logs against them.</li>
            <li>Study session times — when you start, pause, and finish a timed study session, and for which subject.</li>
            <li>Feedback messages you choose to send us.</li>
            <li>
              If you turn on notifications: a push subscription token from your browser, used only to send you the
              reminder you asked for.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">What we don’t collect</h2>
          <p className="mt-2">
            No analytics or tracking scripts, no advertising identifiers, no data sold or shared with advertisers. We
            don’t read your journal entries for any purpose other than showing them back to you. The only cookie is a
            single, first-party session cookie that keeps you signed in — nothing from a third party.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Where it’s stored</h2>
          <p className="mt-2">
            Data lives in a Postgres database and file storage hosted by Supabase, served through Vercel’s hosting
            infrastructure. Both are reputable infrastructure providers with their own security practices; we don’t
            operate our own servers.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">How long we keep it</h2>
          <p className="mt-2">
            Your data is kept for as long as your account exists. If you’d like your account and everything in it
            deleted, email us (below) and we’ll remove it.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Security</h2>
          <p className="mt-2">
            Passwords are hashed, never stored in plain text. All traffic to the app is encrypted (HTTPS). No system
            is perfectly secure, but we don’t do anything that adds unnecessary risk — no third-party trackers, no
            data reselling.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">If you’re under 18</h2>
          <p className="mt-2">
            Proudly is built with school-age and university-age users in mind. We don’t require any information
            beyond what’s needed to run the app, and we don’t do anything with your data beyond showing it back to
            you. If you’re a parent or guardian with questions about a young person’s use of the app, contact us
            below.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Your rights</h2>
          <p className="mt-2">
            You can ask us what data we hold about you, ask for a copy of it, or ask for it to be deleted, at any
            time — just email us.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Changes to this policy</h2>
          <p className="mt-2">
            If this policy changes in a meaningful way, we’ll update the date at the top of this page.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Contact</h2>
          <p className="mt-2">
            Questions, requests, or concerns:{" "}
            <a href="mailto:proudlysupporting@gmail.com" className="text-accent hover:underline">
              proudlysupporting@gmail.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
