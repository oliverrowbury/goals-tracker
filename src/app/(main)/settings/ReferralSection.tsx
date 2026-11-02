import { CopyLinkButton } from "../friends/CopyLinkButton";
import { formatLong } from "@/lib/dates";
import { REFERRAL_REWARD_DAYS } from "@/lib/constants";

// Same fallback pattern as layout.tsx/sitemap.ts/robots.ts — this is only
// ever used for the friendly display string below the input, not the
// actual copied URL (CopyLinkButton resolves the real origin client-side,
// so it's correct on a preview deployment even when this label still says
// the production domain).
const SITE_HOST = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://proudlyapp.co.uk").replace(/^https?:\/\//, "");

export function ReferralSection({
  code,
  referralCount,
  activeBonusUntil,
}: {
  code: string;
  referralCount: number;
  activeBonusUntil: Date | null;
}) {
  const path = `/signup?ref=${code}`;
  const bonusActive = !!activeBonusUntil && activeBonusUntil > new Date();

  return (
    <div>
      <p className="mb-4 text-sm text-ink-muted">
        Share your link — a friend who signs up gets {REFERRAL_REWARD_DAYS} days of Premium free, and so do you, once
        they finish setting up their profile.
      </p>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3">
        <code className="flex-1 truncate text-sm text-ink-muted">
          {SITE_HOST}
          {path}
        </code>
        <CopyLinkButton path={path} />
      </div>

      {(referralCount > 0 || bonusActive) && (
        <p className="mt-3 text-xs text-ink-muted">
          {referralCount > 0 && `${referralCount} friend${referralCount === 1 ? "" : "s"} joined through your link`}
          {referralCount > 0 && bonusActive && " · "}
          {bonusActive && `Bonus Premium active until ${formatLong(activeBonusUntil!.toISOString().slice(0, 10))}`}
        </p>
      )}
    </div>
  );
}
