import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-xl text-ink">
        <Wordmark />
      </Link>

      <h1 className="mt-8 font-serif text-2xl font-semibold text-ink">Privacy Policy</h1>
      <p className="mt-1 text-sm text-ink-muted">Last updated 15 September 2026.</p>

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
              Profile details: your birthday, gender, and city (required to use the app — birthday is how we confirm
              you meet our minimum age), plus a username, and anything optional you choose to add — a photo, bio,
              pronouns, weight, and height. Weight and height are never required.
            </li>
            <li>
              What you write: journal entries, mood check-ins, prompt answers, and any photos you choose to attach to
              an entry. This is never shown to anyone but you, follower relationships included.
            </li>
            <li>Goals you set and your progress logs against them.</li>
            <li>Study session times — when you start, pause, and finish a timed study session, and for which subject.</li>
            <li>
              Workout details, including — only while a cardio session is actively running, and only if you allow
              location access — GPS coordinates used to draw your route, measure distance, and compute pace and
              elevation. This is never collected in the background or outside an active session.
            </li>
            <li>
              Social activity you choose to share: if you follow someone (or they follow you), your workout/study
              streaks and finished activities are visible to accepted followers only for whichever categories
              you’ve opted to share — never your journal.
            </li>
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
            No advertising identifiers, no data sold or shared with advertisers. We don’t read your journal entries
            for any purpose other than showing them back to you. The only cookie is a single, first-party session
            cookie that keeps you signed in — nothing from a third party.
          </p>
          <p className="mt-2">
            We use Vercel Web Analytics to see how many people visit and which pages they use. It’s cookieless and
            doesn’t collect any personal data — it can’t identify you individually, only anonymous, aggregate counts
            like page views and visitor totals.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Where it’s stored, and who else sees it</h2>
          <p className="mt-2">
            Data lives in a Postgres database and file storage hosted by Supabase (in the EU — Ireland), served
            through Vercel’s hosting infrastructure (also running in Europe). We use Resend to send account emails
            (welcome, password-changed) — it only ever receives your email address and name, never anything you’ve
            written. None of these providers can read your journal; the app is the only thing that decrypts and
            displays it. We don’t sell or share your data with anyone for advertising, and we’ve never had a data
            breach.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">How long we keep it</h2>
          <p className="mt-2">
            Your data is kept for as long as your account exists. You can permanently delete your account and
            everything in it yourself, any time, from Settings — no need to email us, though you’re welcome to if
            you’d rather.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Security</h2>
          <p className="mt-2">
            Passwords are hashed (scrypt), never stored in plain text. All traffic to the app is encrypted (HTTPS).
            Nothing about your account — email, password, profile — is ever exposed to a browser except your own. No
            system is perfectly secure, but we don’t do anything that adds unnecessary risk — no third-party
            trackers, no data reselling.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Minimum age</h2>
          <p className="mt-2">
            You need to be at least 13 to use Proudly — we check this against the birthday you give us when you set
            up your account, and won’t let an account through under that age. If you’re a parent or guardian and
            believe a child under 13 has an account, contact us below and we’ll remove it.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Your rights</h2>
          <p className="mt-2">
            Under UK GDPR you can ask what data we hold about you, ask for a copy of it (Settings has a one-click
            export), ask for it to be corrected, or ask for it to be deleted (Settings also has a one-click delete —
            see above). You can also object to or ask us to restrict certain processing. For anything Settings
            doesn’t cover directly, email us below. If you’re unhappy with how we’ve handled a request, you can
            complain to the UK Information Commissioner’s Office (ico.org.uk) — we’d appreciate the chance to sort it
            out directly first.
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
