"use client";
import { useEffect } from "react";

/** November 15: a link to #details (Edit details) opens that collapsed section. */
export default function OpenOnHash({ ids }: { ids: string[] }) {
  useEffect(() => {
    const openId = (id: string) => {
      if (!ids.includes(id)) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) el.open = true;
      // November 23: a section inside a folded one (her circles inside "Your progress") opens the folded one too.
      for (let p = el?.parentElement?.closest("details"); p; p = p.parentElement?.closest("details")) p.open = true;
      el?.scrollIntoView({ block: "start" });
    };
    const open = () => openId(location.hash.slice(1));
    // A link on this same page (the app's own links change the address without a hashchange event).
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a?.href) return;
      const u = new URL(a.href, location.href);
      if (u.pathname === location.pathname && u.hash) setTimeout(() => openId(u.hash.slice(1)), 50);
    };
    open();
    window.addEventListener("hashchange", open);
    document.addEventListener("click", click);
    return () => { window.removeEventListener("hashchange", open); document.removeEventListener("click", click); };
  }, [ids]);
  return null;
}
