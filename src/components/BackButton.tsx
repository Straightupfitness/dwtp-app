"use client";
import { useRouter } from "next/navigation";

/**
 * "‹ Back" at the top of screens that aren't a bottom tab. Goes back to wherever she came from in the app;
 * if she landed here from a notification or an email (nothing to go back to), it goes to `fallback`.
 */
export default function BackButton({ fallback = "/today", label = "Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  function go() {
    let inApp = false;
    try { inApp = Number(sessionStorage.getItem("dwtp:screens") ?? 0) > 1 && window.history.length > 1; } catch {}
    if (inApp) router.back(); else router.push(fallback);
  }
  return (
    <button type="button" onClick={go} className="-ml-1 inline-flex min-h-11 items-center gap-1 pr-2 text-sm text-dim">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      {label}
    </button>
  );
}
