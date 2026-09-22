"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDownIcon } from "@/components/Icons";

// Your own profile card ends with this instead of always dumping your post
// history below it — a plain tap gate, so opening your own profile (e.g.
// just to grab your share link, or check a streak) doesn't also render your
// whole activity list every time. `cardContent` is everything the card
// already showed; `activity` is the post list, rendered as a sibling below
// the card once revealed, only once (not toggled back off, since collapsing
// after fetching it server-side already has no cost to hide again — see
// onClick below, which does keep it toggleable either way).
export function RevealActivity({ cardContent, activity }: { cardContent: ReactNode; activity: ReactNode }) {
  const [show, setShow] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        {cardContent}
        <div className="mt-4 flex justify-end border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-calm hover:underline"
          >
            {show ? "Hide activities" : "Show activities"}
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${show ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      {show && activity}
    </>
  );
}
