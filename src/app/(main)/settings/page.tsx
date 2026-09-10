import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { updateName, renameSubject, setSubjectActive } from "./actions";
import { PasswordForm } from "./PasswordForm";
import { NewSubjectForm } from "./NewSubjectForm";
import { NotificationsForm } from "./NotificationsForm";
import { HelpSection } from "./HelpSection";
import { FeedbackForm } from "./FeedbackForm";
import { GearIcon, ClockIcon, BellIcon, HelpIcon, MessageIcon } from "@/components/Icons";
import { formatLong } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const [subjects, feedback] = await Promise.all([
    prisma.subject.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    prisma.feedback.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const active = subjects.filter((s) => s.active);
  const archived = subjects.filter((s) => !s.active);

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-2.5">
        <GearIcon className="h-5 w-5 shrink-0 text-ink-muted" />
        <h1 className="font-serif text-2xl font-semibold text-ink">Settings</h1>
      </div>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Your name</h2>
        <p className="mb-4 text-sm text-ink-muted">Shown nowhere but here, for now — kept for later use.</p>
        <form action={updateName} className="flex max-w-sm gap-2">
          <input
            name="name"
            defaultValue={user.name}
            required
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong">
            Save
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Password</h2>
        <p className="mb-4 text-sm text-ink-muted">Changes immediately — no redeploy needed.</p>
        <PasswordForm />
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <BellIcon className="h-4 w-4 text-accent" />
          Notifications
        </h2>
        <p className="mb-4 text-sm text-ink-muted">A daily nudge to check in, sent as a browser push.</p>
        <NotificationsForm reminderEnabled={user.reminderEnabled} reminderTime={user.reminderTime} />
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <ClockIcon className="h-4 w-4 text-study" />
          Study subjects
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          Rename or archive the ones you have — archiving keeps its history but takes it off the
          picker on the Study page.
        </p>

        {active.length === 0 && archived.length === 0 && (
          <p className="mb-4 text-sm text-ink-muted">No subjects yet.</p>
        )}

        <ul className="mb-4 space-y-2">
          {active.map((subject) => (
            <li key={subject.id} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
              <form action={renameSubject.bind(null, subject.id)} className="flex flex-1 gap-2">
                <input
                  name="name"
                  defaultValue={subject.name}
                  className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
                />
                <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-accent hover:text-accent">
                  Save
                </button>
              </form>
              <form action={setSubjectActive.bind(null, subject.id, false)}>
                <button type="submit" className="text-sm text-ink-muted hover:text-accent">
                  Archive
                </button>
              </form>
            </li>
          ))}
        </ul>

        <NewSubjectForm />

        {archived.length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <p className="mb-2 text-xs font-medium text-ink-muted">Archived</p>
            <ul className="space-y-1.5">
              {archived.map((subject) => (
                <li key={subject.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">{subject.name}</span>
                  <form action={setSubjectActive.bind(null, subject.id, true)}>
                    <button type="submit" className="text-ink-muted hover:text-accent">
                      Reactivate
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <HelpIcon className="h-4 w-4 text-ink-muted" />
          Help
        </h2>
        <p className="mb-4 text-sm text-ink-muted">Common questions — tap one to expand it.</p>
        <HelpSection />
      </section>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-ink">
          <MessageIcon className="h-4 w-4 text-accent" />
          Feedback
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          Bugs, ideas, things that annoy you — this goes straight to Oliver, not an app store review.
        </p>
        <FeedbackForm />

        {feedback.length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <p className="mb-2 text-xs font-medium text-ink-muted">Previously sent</p>
            <ul className="space-y-2">
              {feedback.map((f) => (
                <li key={f.id} className="rounded-lg border border-line bg-paper px-3.5 py-2 text-sm">
                  <p className="text-ink">{f.message}</p>
                  <p className="mt-1 text-xs text-ink-muted">{formatLong(f.createdAt.toISOString().slice(0, 10))}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="text-center text-xs text-ink-muted">
        <Link href="/privacy" className="hover:text-accent hover:underline">
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/terms" className="hover:text-accent hover:underline">
          Terms of Service
        </Link>
      </p>
    </div>
  );
}
