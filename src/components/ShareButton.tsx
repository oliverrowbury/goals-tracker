"use client";

import { useState } from "react";
import { ShareIcon } from "@/components/Icons";
import { renderShareCard, type ShareCardData } from "@/lib/shareCard";

// The accent is passed as a CSS custom property name (e.g. "--workout")
// rather than a resolved color — resolved at click time via
// getComputedStyle so the generated card always matches whatever the
// current theme (light/dark) has on screen, without this component
// needing to know the actual hex values.
export function ShareButton({
  data,
  accentVar,
  fileName,
  shareTitle,
  shareText,
  className,
}: {
  data: Omit<ShareCardData, "accentHex">;
  accentVar: string;
  fileName: string;
  shareTitle: string;
  shareText: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    setBusy(true);
    try {
      const accentHex = getComputedStyle(document.documentElement).getPropertyValue(accentVar).trim() || "#8570b3";
      const blob = await renderShareCard({ ...data, accentHex });
      const file = new File([blob], fileName, { type: "image/png" });

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: shareTitle, text: shareText });
      } else if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      // AbortError just means the user closed the share sheet — not worth
      // surfacing as a failure.
      if ((err as Error)?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(shareText);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Nothing more we can do — silently give up.
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={busy}
      className={
        className ??
        "flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
      }
    >
      <ShareIcon className="h-3.5 w-3.5" />
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
