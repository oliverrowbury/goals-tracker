// The word set flat, with the ascending-bars mark trailing off the end of
// the "y" — the steps do the climbing, not the whole word. Sized in `em`
// so it scales cleanly wherever it's dropped (nav bar vs. login card)
// just by setting a font-size on an ancestor.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.28em] font-serif font-semibold ${className}`}>
      <span>Proudly</span>
      <span className="inline-flex items-end gap-[0.07em]" aria-hidden="true">
        <span className="block w-[0.13em] rounded-t-[1px] bg-accent" style={{ height: "0.16em" }} />
        <span className="block w-[0.13em] rounded-t-[1px] bg-accent" style={{ height: "0.28em" }} />
        <span className="block w-[0.13em] rounded-t-[1px] bg-accent" style={{ height: "0.4em" }} />
        <span className="block w-[0.13em] rounded-t-[1px] bg-accent" style={{ height: "0.54em" }} />
      </span>
    </span>
  );
}
