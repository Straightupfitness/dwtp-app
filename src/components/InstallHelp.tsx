"use client";
import { useEffect, useState } from "react";

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global { interface Window { __dwtpInstall?: Prompt | null } }

/** Catch Android's "install this app" offer as early as possible (it fires once, soon after the page loads). */
export function InstallCatcher() {
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); window.__dwtpInstall = e as Prompt; window.dispatchEvent(new Event("dwtp:installable")); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  return null;
}

/**
 * How to put DWTP on her Home Screen, for her exact phone and browser (October 31: an iPhone client couldn't
 * "download" it, and Android's menu wording moved). Android Chrome gets a one-tap Install button when it allows.
 */
export default function InstallHelp() {
  const [env, setEnv] = useState<"ios-safari" | "ios-other" | "android-samsung" | "android" | "desktop" | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    const otherIos = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Outlook|YahooMobile|Line\//i.test(ua) || !/Safari\//.test(ua);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser
    setEnv(ios ? (otherIos ? "ios-other" : "ios-safari") : /android/i.test(ua) ? (/SamsungBrowser/i.test(ua) ? "android-samsung" : "android") : "desktop");
    setCanInstall(!!window.__dwtpInstall);
    const on = () => setCanInstall(true);
    window.addEventListener("dwtp:installable", on);
    return () => window.removeEventListener("dwtp:installable", on);
  }, []);
  if (!env) return null;
  const b = "text-text font-semibold";
  const steps: React.ReactNode[] =
    env === "ios-safari" ? [<>Tap the <b className={b}>Share</b> button (the square with the arrow, at the bottom; on newer iPhones tap <b className={b}>•••</b> first).</>,
      <>Scroll down and tap <b className={b}>Add to Home Screen</b>.</>, <>Tap <b className={b}>Add</b>, then open <b className={b}>DWTP</b> from your Home Screen.</>]
    : env === "ios-other" ? [<>This page is open inside another app. Tap <b className={b}>Copy link</b> below.</>, <>Open <b className={b}>Safari</b>, paste it in the address bar and go.</>,
      <>In Safari: <b className={b}>Share</b>, then <b className={b}>Add to Home Screen</b>, then <b className={b}>Add</b>.</>]
    : env === "android-samsung" ? [<>Tap the <b className={b}>≡</b> menu at the bottom right.</>, <>Tap <b className={b}>Add page to</b>, then <b className={b}>Home screen</b>.</>, <>Open <b className={b}>DWTP</b> from your Home Screen.</>]
    : env === "android" ? [<>Tap the <b className={b}>⋮</b> menu at the top right.</>, <>Tap <b className={b}>Add to home screen</b> (on some phones it says <b className={b}>Install app</b>; scroll down the menu if you don&apos;t see it).</>,
      <>Tap <b className={b}>Install</b>, then open <b className={b}>DWTP</b> from your Home Screen.</>]
    : [<>Open this page on your phone to add it to your Home Screen.</>];
  return (
    <div className="space-y-2">
      {canInstall && (
        <button type="button" onClick={async () => { const p = window.__dwtpInstall; if (!p) return; await p.prompt(); await p.userChoice.catch(() => null); window.__dwtpInstall = null; setCanInstall(false); }}
          className="min-h-11 w-full rounded-lg bg-accent text-[15px] font-semibold text-black">Install the DWTP app</button>
      )}
      <ol className="space-y-1 text-[13px] leading-relaxed text-[#d0b4b0]">
        {steps.map((s, i) => <li key={i} className="flex gap-2"><span className="font-semibold text-[#ff8a7e]">{i + 1}.</span><span>{s}</span></li>)}
      </ol>
      {env === "ios-other" && (
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(location.origin + "/today"); setCopied(true); } catch { /* no clipboard */ } }}
          className="min-h-10 rounded-lg border border-[#5a2a25] px-3 text-[13px] font-semibold text-[#ff8a7e]">{copied ? "Copied ✓ Now open Safari" : "Copy link"}</button>
      )}
      <p className="text-[12px] text-[#a88a85]">It isn&apos;t in the App Store or Play Store: the app lives on your Home Screen this way.</p>
    </div>
  );
}
