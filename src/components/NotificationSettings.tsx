"use client";
import { useEffect, useState } from "react";

function urlB64(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Turn push notifications on or off for this phone. On iPhone they need the app on the Home Screen. */
export default function NotificationSettings({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<"loading" | "unsupported" | "ios-install" | "off" | "on" | "blocked">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setState(ios && !standalone ? "ios-install" : "unsupported"); return; }
      if (Notification.permission === "denied") { setState("blocked"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true); setError("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "blocked" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey, error: e } = await (await fetch("/api/push")).json();
      if (!publicKey) throw new Error(e || "No key");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(publicKey) });
      const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error((await res.json()).error);
      setState("on");
    } catch (e) { setError(`Couldn't turn them on: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  async function turnOff() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off"); setBusy(false);
  }

  if (state === "loading" || (compact && (state === "on" || state === "unsupported"))) return null;
  const box = "space-y-2 rounded-xl border border-border bg-card p-3";
  if (state === "ios-install") return (
    <div className={box}>
      <p className="font-medium">Get notified when Michael replies</p>
      <p className="text-sm text-dim">On iPhone: tap the Share button in Safari, then <b className="text-text">Add to Home Screen</b>. Open DWTP from your Home Screen and turn notifications on here.</p>
    </div>
  );
  if (state === "unsupported") return <p className="text-sm text-dim">This browser can&apos;t show notifications. You&apos;ll get emails instead.</p>;
  if (state === "blocked") return <p className="text-sm text-dim">Notifications are blocked for this app. Turn them on in your phone&apos;s settings for this site, then come back.</p>;
  return (
    <div className={box}>
      <p className="font-medium">{state === "on" ? "Notifications are on for this phone" : "Get notified when Michael replies"}</p>
      {state === "off" && <p className="text-sm text-dim">Replies, messages and your check-in reminders.</p>}
      <button type="button" disabled={busy} onClick={state === "on" ? turnOff : turnOn}
        className={`min-h-11 rounded-lg px-4 font-semibold disabled:opacity-50 ${state === "on" ? "border border-border" : "bg-accent text-black"}`}>
        {busy ? "…" : state === "on" ? "Turn off" : "Turn on notifications"}
      </button>
      {error && <p className="text-sm text-[var(--red)]">{error}</p>}
    </div>
  );
}
