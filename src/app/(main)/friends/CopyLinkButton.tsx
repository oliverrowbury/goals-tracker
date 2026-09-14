"use client";

import { useState } from "react";

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — nothing to fall back to that's worth
      // building for how rarely this happens.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-calm hover:text-calm"
    >
      {copied ? "Copied!" : "Copy my friend link"}
    </button>
  );
}
