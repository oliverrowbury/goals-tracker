// The word set flat, with the ascending-bars mark trailing off the end of
// the "y" — the steps do the climbing, not the whole word. Sized in `em`
// so it scales cleanly wherever it's dropped (nav bar vs. login card)
// just by setting a font-size on an ancestor. Each bar takes one of the
// app's four section colors (Journal/Goals/Study/Wellness) instead of a
// single flat tone — the mark doubles as a little key to what's inside.
const BAR_COLORS = ["bg-accent", "bg-goals", "bg-study", "bg-calm"];

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.28em] font-serif font-semibold ${className}`}>
      <span>Proudly</span>
      <span className="inline-flex items-end gap-[0.07em]" aria-hidden="true">
        {[0.16, 0.28, 0.4, 0.54].map((h, i) => (
          <span key={h} className={`block w-[0.13em] rounded-t-[1px] ${BAR_COLORS[i]}`} style={{ height: `${h}em` }} />
        ))}
      </span>
    </span>
  );
}
