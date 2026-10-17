"use client";

import { useEffect } from "react";
import { generateTodaysPrompt } from "./actions";

// Mounted only when a Premium user's cached prompt isn't from today yet —
// fires the generation server action once it's actually rendered in their
// browser, same "not a write in HomePage's own render body" reasoning as
// MarkRecapSeen. The home page already shows the fixed prompt-of-the-day
// in the meantime, so this just quietly upgrades it once the AI call
// resolves (see generateTodaysPrompt's revalidatePath).
export function GeneratePersonalizedPrompt() {
  useEffect(() => {
    generateTodaysPrompt();
  }, []);
  return null;
}
