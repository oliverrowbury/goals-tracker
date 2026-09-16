import type { ComponentType } from "react";

// The dashed-border/icon-badge/one-line-copy empty state Goals/Deadlines/
// Friends already established — extracted so Journal/Study/Workout (which
// had no empty state at all) can use the same pattern instead of just
// omitting content silently.
export function EmptyState({
  icon: Icon,
  iconClassName = "bg-accent-soft text-accent",
  message,
}: {
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      {Icon && (
        <span className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full ${iconClassName}`}>
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="text-sm text-ink-muted">{message}</p>
    </div>
  );
}
