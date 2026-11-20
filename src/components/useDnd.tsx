"use client";
import { useEffect, useRef, useState } from "react";

/**
 * November 19: drag and drop that works with a mouse and on a phone. Spread bind(id, label) on what she drags;
 * put data-drop="<target>" on each place it can land (and data-before="<id>" on items, to land in front of one).
 * With a mouse the whole item drags; on a phone, only the part with data-grip (so the page still scrolls).
 */
export function useDnd(onDrop: (id: string, target: string, before: string | null) => void) {
  const [drag, setDrag] = useState<{ id: string; label: string; x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const start = useRef<{ id: string; label: string; x: number; y: number; live: boolean } | null>(null);
  const dropRef = useRef(onDrop);
  useEffect(() => { dropRef.current = onDrop; });
  const justDragged = useRef(false);

  useEffect(() => {
    const target = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const zone = el?.closest("[data-drop]") as HTMLElement | null;
      const before = el?.closest("[data-before]") as HTMLElement | null;
      return { zone: zone?.dataset.drop ?? null, before: before && zone?.contains(before) ? before.dataset.before ?? null : null };
    };
    const move = (e: PointerEvent) => {
      const s = start.current;
      if (!s) return;
      if (!s.live && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return;
      s.live = true;
      e.preventDefault();
      setDrag({ id: s.id, label: s.label, x: e.clientX, y: e.clientY });
      setOver(target(e.clientX, e.clientY).zone);
    };
    const up = (e: PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s?.live) return;
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 50);
      const t = target(e.clientX, e.clientY);
      setDrag(null); setOver(null);
      if (t.zone && t.before !== s.id) dropRef.current(s.id, t.zone, t.before);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, []);

  const bind = (id: string, label: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.pointerType !== "mouse" && !t.closest("[data-grip]")) return;
      start.current = { id, label, x: e.clientX, y: e.clientY, live: false };
    },
    onClickCapture: (e: React.MouseEvent) => { if (justDragged.current) { e.stopPropagation(); e.preventDefault(); } },
    style: drag?.id === id ? { opacity: 0.35 } : undefined,
  });
  const ghost = drag ? (
    <div className="pointer-events-none fixed z-50 max-w-[16rem] -translate-x-1/2 -translate-y-1/2 truncate rounded-lg border border-accent bg-[#1f1708] px-3 py-1.5 text-[13px] font-semibold text-text shadow-xl"
      style={{ left: drag.x, top: drag.y }}>{drag.label}</div>
  ) : null;
  return { bind, ghost, over, dragging: drag?.id ?? null };
}

/** The little grip to drag with on a phone. */
export const Grip = () => (
  <span data-grip className="grid w-5 shrink-0 cursor-grab touch-none place-items-center self-stretch text-[#5a5a5a]" aria-hidden="true">
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2" cy="3" r="1.4" /><circle cx="8" cy="3" r="1.4" /><circle cx="2" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="2" cy="13" r="1.4" /><circle cx="8" cy="13" r="1.4" /></svg>
  </span>
);
