"use client";

import { useEffect } from "react";
import { markFreeRecapSeen } from "./actions";

// Mounted only alongside the one full weekly recap a free-tier user ever
// gets — fires once the recap has actually rendered in their browser, so
// every recap after this one renders locked. See markFreeRecapSeen for why
// this isn't just a write in HomePage's own render body.
export function MarkRecapSeen() {
  useEffect(() => {
    markFreeRecapSeen();
  }, []);
  return null;
}
