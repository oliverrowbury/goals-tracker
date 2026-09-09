export function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="8" y="30" width="8" height="12" rx="1.5" fill="currentColor" />
      <rect x="20" y="20" width="8" height="22" rx="1.5" fill="currentColor" />
      <rect x="32" y="8" width="8" height="34" rx="1.5" fill="currentColor" />
    </svg>
  );
}
