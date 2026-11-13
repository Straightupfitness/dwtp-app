"use client";
import { useEffect } from "react";
import { seenNow } from "@/app/(app)/seen-action";

/** November 13: counts her as "seen" when she comes back to the app from the background, too. */
export default function StillHere() {
  useEffect(() => {
    let last = Date.now();
    const back = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 10 * 60_000) return;
      last = Date.now();
      seenNow().catch(() => {});
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, []);
  return null;
}
