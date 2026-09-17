// The word set flat, with the ascending-bars mark trailing off the end of
// the "y" — the steps do the climbing, not the whole word. Sized in `em`
// so it scales cleanly wherever it's dropped (nav bar vs. login card)
// just by setting a font-size on an ancestor.
const BAR_HEIGHTS_EM = [0.16, 0.28, 0.4, 0.54];

export function Wordmark({ className = "", animated = false }: { className?: string; animated?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-[0.28em] font-serif font-semibold ${className}`}>
      <span
        className={animated ? "inline-block animate-[logo-in_0.65s_cubic-bezier(0.16,1,0.3,1)_0.2s_both]" : ""}
      >
        Proudly
      </span>
      <span className="inline-flex items-end gap-[0.07em]" aria-hidden="true">
        {BAR_HEIGHTS_EM.map((h, i) => (
          <span
            key={i}
            className={`block w-[0.13em] origin-bottom rounded-t-[1px] bg-gradient-to-t from-accent to-accent-strong ${
              animated ? "animate-[bar-grow_0.55s_cubic-bezier(0.34,1.56,0.64,1)_both]" : ""
            }`}
            style={{ height: `${h}em`, animationDelay: animated ? `${0.82 + i * 0.1}s` : undefined }}
          />
        ))}
      </span>
    </span>
  );
}
