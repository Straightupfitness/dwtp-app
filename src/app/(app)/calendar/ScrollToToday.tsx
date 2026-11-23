"use client";
import { useEffect } from "react";

/** November 23: the calendar opens on today, with past days above and coming days below. */
export default function ScrollToToday() {
  useEffect(() => {
    const go = () => document.getElementById("today")?.scrollIntoView({ block: "start" });
    go();
    const t = setTimeout(go, 80); // after the app's own scroll-to-top on navigation
    return () => clearTimeout(t);
  }, []);
  return null;
}
