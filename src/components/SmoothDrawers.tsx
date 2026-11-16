"use client";
import { useEffect } from "react";

/**
 * November 15 (Michael): the collapsible sections open and close like a drawer, smooth but quick, instead of
 * snapping. One listener for every <details data-drawer> on the page. Skipped when the phone asks for less motion.
 */
export default function SmoothDrawers() {
  useEffect(() => {
    const MS = 220;
    const running = new WeakMap<HTMLDetailsElement, Animation>();
    function onClick(e: MouseEvent) {
      const summary = (e.target as HTMLElement).closest("summary");
      const d = summary?.parentElement;
      if (!summary || !(d instanceof HTMLDetailsElement) || !d.hasAttribute("data-drawer")) return;
      if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !d.animate) return;
      e.preventDefault();
      running.get(d)?.cancel();
      const startH = d.offsetHeight;
      const closing = d.open;
      let endH: number;
      if (closing) {
        const cs = getComputedStyle(d);
        endH = summary.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      } else {
        d.open = true;
        endH = d.offsetHeight;
      }
      d.style.overflow = "hidden";
      const a = d.animate({ height: [`${startH}px`, `${endH}px`] }, { duration: MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      running.set(d, a);
      a.onfinish = () => { if (closing) d.open = false; d.style.overflow = ""; running.delete(d); };
      a.oncancel = () => { d.style.overflow = ""; };
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
