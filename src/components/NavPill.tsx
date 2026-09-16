import Link from "next/link";
import type { ReactNode } from "react";

// The "← Prev / Today / Next →" pill link Calendar and Journal each hand-
// rolled slightly differently — one shared version so their day/month nav
// can't drift apart again.
export function NavPill({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-accent hover:text-accent"
    >
      {children}
    </Link>
  );
}
