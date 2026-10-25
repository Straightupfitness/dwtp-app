"use client";
import { useLayoutEffect, useRef, useState } from "react";

/** The date on one line, and under it a bigger line sized to exactly the date's width. */
export default function FitWidth({ top, big, className }: { top: string; big: string; className?: string }) {
  const topRef = useRef<HTMLParagraphElement>(null);
  const bigRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(22);
  useLayoutEffect(() => {
    const fit = () => {
      const t = topRef.current, b = bigRef.current;
      if (!t || !b) return;
      b.style.fontSize = "100px";
      const w = b.getBoundingClientRect().width;
      setSize(w ? Math.max(14, Math.min(48, (100 * t.getBoundingClientRect().width) / w)) : 22);
      b.style.fontSize = "";
    };
    fit();
    document.fonts?.ready.then(fit);
  }, [top, big]);
  return (
    <div className="inline-block">
      <p ref={topRef} className="inline-block text-[11px] uppercase tracking-[0.15em] text-accent">{top}</p>
      <p className={`whitespace-nowrap leading-[1.05] ${className ?? ""}`}>
        <span ref={bigRef} style={{ fontSize: size }}>{big}</span>
      </p>
    </div>
  );
}
