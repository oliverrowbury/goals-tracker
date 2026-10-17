// Same placement pattern as OwnerBadge — shown next to a name on a
// profile card, not everywhere isPremium is checked elsewhere in the app.
export function PremiumBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      💛 Premium
    </span>
  );
}
