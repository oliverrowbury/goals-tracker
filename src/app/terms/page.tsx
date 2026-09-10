import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export const metadata = { title: "Terms of Service — Proudly" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-xl text-ink">
        <Wordmark />
      </Link>

      <h1 className="mt-8 font-serif text-2xl font-semibold text-ink">Terms of Service</h1>
      <p className="mt-1 text-sm text-ink-muted">Last updated 10 September 2026.</p>

      <div className="prose-sm mt-6 space-y-5 text-sm leading-relaxed text-ink">
        <p>By using Proudly, you agree to these terms. Read them alongside our Privacy Policy.</p>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">What Proudly is</h2>
          <p className="mt-2">
            Proudly is a personal journaling, goal-tracking, and study-timer app, with some lightweight wellness
            features (a daily mood check-in and a breathing exercise). It’s a free, personal project — not a
            registered company, and not a medical, therapeutic, or mental health service.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Not medical or mental health advice</h2>
          <p className="mt-2">
            The mood tracker, breathing exercise, and journaling prompts are simple wellness tools, not a substitute
            for professional support. If you’re struggling, please talk to a doctor, a trusted adult, or a service
            like Samaritans (116 123, free, UK — samaritans.org) or Shout (text SHOUT to 85258). In an emergency,
            call 999 (UK) or your local emergency number.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Your account</h2>
          <p className="mt-2">
            Keep your password to yourself. You’re responsible for what happens under your account. Tell us if you
            think someone else has access to it.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Your content</h2>
          <p className="mt-2">
            Whatever you write or upload is yours. We don’t claim ownership of it, read it for any purpose beyond
            showing it back to you, or use it to train any model. Don’t upload anything illegal, or content you
            don’t have the right to upload (e.g. someone else’s private photos without permission).
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">No warranty</h2>
          <p className="mt-2">
            Proudly is provided free, “as is,” with no guarantee it will always be available, bug-free, or suit any
            particular purpose. It may change, break, or be discontinued at any time, without notice — it’s a
            personal project, run and maintained by one person.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Limitation of liability</h2>
          <p className="mt-2">
            To the fullest extent the law allows, Proudly and its creator aren’t liable for any loss or damage
            arising from your use of the app — including lost data. We take reasonable care with your data (see the
            Privacy Policy), but back up anything genuinely irreplaceable elsewhere too.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Ending your account</h2>
          <p className="mt-2">
            You can ask us to delete your account and data at any time. We may also suspend or remove an account
            that’s used to break these terms or the law.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Governing law</h2>
          <p className="mt-2">These terms are governed by the law of England and Wales.</p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Changes to these terms</h2>
          <p className="mt-2">If these terms change meaningfully, we’ll update the date at the top of this page.</p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">Contact</h2>
          <p className="mt-2">
            Questions about these terms:{" "}
            <a href="mailto:proudlysupporting@gmail.com" className="text-accent hover:underline">
              proudlysupporting@gmail.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
