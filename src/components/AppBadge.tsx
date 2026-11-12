"use client";
import { useEffect } from "react";

/**
 * November 11: the number on the app icon = notifications she hasn't opened in Alerts. Before, the phone kept
 * counting every push she'd ever been sent, and nobody could tell what they were.
 */
export default function AppBadge({ count }: { count: number }) {
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try {
      if (count > 0) nav.setAppBadge?.(count)?.catch(() => {});
      else nav.clearAppBadge?.()?.catch(() => {});
    } catch {}
    // Nothing left unread: clear the old ones out of the phone's notification list too.
    if (count === 0 && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.getNotifications().then((ns) => ns.forEach((n) => n.close()))).catch(() => {});
    }
  }, [count]);
  return null;
}
