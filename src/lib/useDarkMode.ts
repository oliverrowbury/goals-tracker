"use client";

import { useEffect, useState } from "react";

// Shared between the small icon-only toggle in the sidebar and the
// clearly-labeled switch on the Settings page — both just reflect/flip the
// class the inline theme script in the root layout already set synchronously
// (avoiding a flash of the wrong theme on load).
export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Deferred to an effect (not a lazy useState initializer) — this reads
    // `document`, which doesn't exist during server rendering, so the
    // initial render always assumes light mode. Correcting it here after
    // mount avoids a hydration mismatch at the cost of a harmless one-frame
    // flash, same tradeoff the root layout's inline script already accepts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function setDark(next: boolean) {
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // not persisted this session — not worth surfacing to the user
    }
  }

  return { isDark, setDark };
}
