import Link from "next/link";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/journal" className="font-semibold">
            Goals Tracker
          </Link>
          <nav className="flex items-center gap-4 text-sm text-neutral-600">
            <Link href="/journal" className="hover:text-neutral-900">
              Journal
            </Link>
            <Link href="/goals" className="hover:text-neutral-900">
              Goals
            </Link>
            <form action="/api/logout" method="POST">
              <button type="submit" className="hover:text-neutral-900">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
