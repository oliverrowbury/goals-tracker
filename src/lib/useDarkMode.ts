"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

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

  // `from` is the element that was clicked — the new theme grows out of its
  // centre as an expanding circle (View Transitions API). Browsers without
  // that API, and people with "reduce motion" on, just get the instant swap.
  function setDark(next: boolean, from?: Element | null) {
    const root = document.documentElement;

    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // not persisted this session — not worth surfacing to the user
    }

    const apply = () => {
      // flushSync so the toggle's own icon/switch state is already in the DOM
      // when the browser snapshots the "after" frame.
      flushSync(() => setIsDark(next));
      root.classList.toggle("dark", next);
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || typeof document.startViewTransition !== "function") {
      apply();
      return;
    }

    const rect = from?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    // Radius to the farthest corner, so the circle always ends up covering
    // the whole screen no matter where the toggle is.
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    root.classList.add("theme-switching");
    const transition = document.startViewTransition(apply);
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          {
            duration: 900,
            easing: "cubic-bezier(0.55, 0, 0.15, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {
        // transition was skipped (e.g. tab hidden) — the theme still applied
      });
    transition.finished.finally(() => root.classList.remove("theme-switching"));
  }

  return { isDark, setDark };
}
