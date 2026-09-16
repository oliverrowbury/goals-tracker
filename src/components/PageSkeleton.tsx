// Loading-state placeholders shown by each route's loading.tsx while its
// server component resolves its (often several, sequential) DB queries —
// every page here is `dynamic = "force-dynamic"`, so without these every
// navigation blank-flashes until the page finishes fetching. Deliberately
// generic/composable rather than one skeleton per page, since the real
// pages already share the same header/card/list shapes.

function Bar({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-line ${className}`} />;
}

// Mirrors the `<Icon /><h1>` header row every page opens with.
export function HeaderSkeleton() {
  return (
    <div className="mb-6 flex items-center gap-2.5">
      <div className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-line" />
      <Bar className="h-7 w-36" />
    </div>
  );
}

export function CardSkeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl border border-line bg-card ${className}`} />;
}

// A `divide-y rounded-2xl border` list of rows, matching the Log/history
// card lists used on Goals/Deadlines/Study/Workout/Friends.
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-line" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bar className="h-4 w-2/3" />
            <Bar className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// The common shape: header, one lead card (timer/form/summary), then a
// history list — Study, Workout, and Deadlines all resolve to roughly this.
export function ListPageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <CardSkeleton className="h-20" />
      <ListSkeleton rows={rows} />
    </div>
  );
}
