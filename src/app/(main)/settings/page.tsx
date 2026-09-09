import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";
import { updateName, renameSubject, setSubjectActive } from "./actions";
import { PasswordForm } from "./PasswordForm";
import { NewSubjectForm } from "./NewSubjectForm";
import { GearIcon, ClockIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const subjects = await prisma.subject.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } });
  const active = subjects.filter((s) => s.active);
  const archived = subjects.filter((s) => !s.active);

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-line/60 text-ink">
          <GearIcon className="h-4.5 w-4.5" />
        </span>
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
    </div>
  );
}
