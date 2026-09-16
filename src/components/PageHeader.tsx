import type { ComponentType, ReactNode } from "react";

// Every page under (main)/ opened with this same icon+title row, hand
// copy-pasted with small drift between pages (margins, a one-off
// translate-y tweak on Journal's icon to align with its two-line title) —
// one shared component instead, so every header stays in sync by
// construction.
export function PageHeader({
  icon: Icon,
  iconClassName = "text-accent",
  title,
  subtitle,
  align,
  right,
  className = "mb-6",
}: {
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  // Defaults to "baseline" whenever a subtitle's passed (so the icon sits
  // against the title line, not centered across both lines) — pass this
  // explicitly for a page like Journal, where the subtitle is conditional
  // (only shown for today) but the layout shouldn't jump between days.
  align?: "center" | "baseline";
  right?: ReactNode;
  className?: string;
}) {
  const baseline = align ? align === "baseline" : !!subtitle;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className={`flex gap-2.5 ${baseline ? "items-baseline" : "items-center"}`}>
        <Icon className={`h-5 w-5 shrink-0 ${baseline ? "translate-y-0.5 " : ""}${iconClassName}`} />
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">{title}</h1>
          {subtitle}
        </div>
      </div>
      {right}
    </div>
  );
}
