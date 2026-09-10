import Link from "next/link";
import { formatLong } from "@/lib/dates";

type Flashback = { dateISO: string; yearsAgo: number; bodyText: string; photoUrl: string | null };

function snippet(text: string, max = 110): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + "…";
}

export function Flashbacks({ flashbacks }: { flashbacks: Flashback[] }) {
  if (flashbacks.length === 0) return null;

  return (
    <div className="mb-8 space-y-2.5">
      <h2 className="text-sm font-medium text-ink-muted">On this day</h2>
      {flashbacks.map((f) => (
        <Link
          key={f.dateISO}
          href={`/journal?date=${f.dateISO}`}
          className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 hover:border-accent"
        >
          {f.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-accent">
              {f.yearsAgo === 1 ? "A year ago today" : `${f.yearsAgo} years ago today`} — {formatLong(f.dateISO)}
            </p>
            {f.bodyText.trim() && <p className="truncate text-sm text-ink-muted">{snippet(f.bodyText)}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}
