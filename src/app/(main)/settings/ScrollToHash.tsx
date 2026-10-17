"use client";

import { useEffect } from "react";

// A full top-level navigation here (Stripe's checkout success_url, the
// billing portal's return_url, or any #section link from elsewhere in the
// app) should land scrolled to that section, not the top of a long page —
// the browser's own anchor-jump mostly handles this, but Next's hydration
// can reset scroll position right after, so this re-does it once mounted.
export function ScrollToHash() {
  useEffect(() => {
    if (!window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  return null;
}
