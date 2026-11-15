"use client";
import { useEffect } from "react";

/** November 15: a link to #details (Edit details) opens that collapsed section. */
export default function OpenOnHash({ ids }: { ids: string[] }) {
  useEffect(() => {
    const open = () => {
      const id = location.hash.slice(1);
      if (!ids.includes(id)) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) el.open = true;
      el?.scrollIntoView({ block: "start" });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [ids]);
  return null;
}
