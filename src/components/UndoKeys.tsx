"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { redoLast, undoLast, undoPeek } from "@/app/undo-actions";

type W = Window & { __dwtpServerAt?: number; __dwtpPlannerAt?: number; __dwtpPlannerSaving?: boolean; __dwtpUndoBusy?: boolean; __dwtpFetchPatched?: boolean };

/**
 * November 20 (Michael): undo and redo everywhere. ⌘Z / Ctrl+Z undoes the last change, ⇧⌘Z / Ctrl+Y redoes it (when
 * she isn't typing in a box, where ⌘Z undoes the typing as usual). After a change an "Undo" button shows for a few
 * seconds, for phones. The KPIs planner has its own undo; whichever was changed last gets the ⌘Z.
 */
export default function UndoKeys() {
  const router = useRouter();
  const [pill, setPill] = useState<null | "undo" | "redo">(null);
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(0);
  const showFor = (what: null | "undo" | "redo", ms = 8000) => { setPill(what); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setPill(null), ms); };

  async function go(kind: "undo" | "redo") {
    const w = window as W;
    w.__dwtpUndoBusy = true;
    try {
      const r = kind === "undo" ? await undoLast() : await redoLast();
      setToast(r.ok ? `${kind === "undo" ? "Undone" : "Redone"}${r.what ? `: ${r.what}` : ""}` : r.error ?? "");
      if (r.ok) { router.refresh(); showFor(kind === "undo" ? "redo" : "undo"); }
      last.current = await undoPeek().catch(() => last.current);
    } finally { w.__dwtpUndoBusy = false; }
    setTimeout(() => setToast(""), 2500);
  }

  useEffect(() => {
    const w = window as W;
    void undoPeek().then((n) => { last.current = n; }).catch(() => {});
    // After any of the app's saves, check whether there's a new step to undo; if so, show the Undo button.
    if (!w.__dwtpFetchPatched) {
      w.__dwtpFetchPatched = true;
      const orig = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const res = await orig(input, init);
        try {
          const h = new Headers(init?.headers);
          if (h.has("next-action") && !w.__dwtpUndoBusy && !w.__dwtpPlannerSaving) window.dispatchEvent(new Event("dwtp:saved"));
        } catch {}
        return res;
      };
    }
    let checking = false;
    const onSaved = async () => {
      if (checking) return; checking = true;
      try {
        const n = await undoPeek();
        if (n > last.current) { last.current = n; w.__dwtpServerAt = Date.now(); showFor("undo"); }
      } catch {} finally { checking = false; }
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && el.matches("input, textarea, select, [contenteditable=true]")) return; // her typing: the box's own undo
      if (el?.closest("[data-planner]")) return;
      if (document.querySelector("[data-planner]") && (w.__dwtpPlannerAt ?? 0) >= (w.__dwtpServerAt ?? 0)) return; // the planner's turn
      e.preventDefault();
      void go(k === "y" || e.shiftKey ? "redo" : "undo");
    };
    window.addEventListener("dwtp:saved", onSaved);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("dwtp:saved", onSaved); window.removeEventListener("keydown", onKey); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- set up once

  if (!pill && !toast) return null;
  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] right-3 z-40 flex items-center gap-2">
      {toast && <span className="rounded-full bg-[#1d1d1d] px-3 py-2 text-[13px] text-text shadow-lg">{toast}</span>}
      {pill && (
        <button type="button" onClick={() => void go(pill)} className="min-h-10 rounded-full border border-accent bg-[#1f1708] px-4 text-[14px] font-semibold text-accent shadow-lg">
          {pill === "undo" ? "↶ Undo" : "↷ Redo"}
        </button>
      )}
    </div>
  );
}
