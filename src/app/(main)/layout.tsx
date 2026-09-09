import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-card/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg text-ink">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-5 text-sm text-ink-muted">
            <Link href="/journal" className="hover:text-accent">
              Journal
            </Link>
            <Link href="/goals" className="hover:text-accent">
              Goals
            </Link>
            <Link href="/study" className="hover:text-accent">
              Study
            </Link>
            <Link href="/settings" className="hover:text-accent">
              Settings
            </Link>
            <form action="/api/logout" method="POST">
              <button type="submit" className="hover:text-accent">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
    </div>
  );
}
