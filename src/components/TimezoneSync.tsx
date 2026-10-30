"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setMyTimezone } from "./timezone-action";

/**
 * Her time zone follows her phone (October 30: an East Coast client saw Pacific times). If the phone's zone differs
 * from the one saved for her, save the phone's and redraw the screen. Travel moves it too.
 */
export default function TimezoneSync({ saved }: { saved: string | null }) {
  const router = useRouter();
  useEffect(() => {
    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return; }
    if (!tz || tz === saved) return;
    setMyTimezone(tz).then((r) => { if (r?.ok) router.refresh(); });
  }, [saved, router]);
  return null;
}
