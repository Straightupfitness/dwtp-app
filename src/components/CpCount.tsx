"use client";
import { useEffect, useRef, useState } from "react";
import { confetti } from "@/lib/celebrate";

const KEY = "dwtp-cps-seen";

/**
 * Her Capacity Points total. When it has gone up since she last saw it (a habit, a quiz, a check-in, a medal),
 * it counts up from the old number, throws confetti and shows "+N" (the sound plays where she earned them).
 */
export default function CpCount({ total }: { total: number }) {
  const [shown, setShown] = useState(total);
  const [gain, setGain] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    let seen: number | null = last.current;
    if (seen === null) { try { const v = localStorage.getItem(KEY); seen = v === null ? null : Number(v); } catch { seen = null; } }
    last.current = total;
    try { localStorage.setItem(KEY, String(total)); } catch { /* private mode */ }
    if (seen === null || !Number.isFinite(seen) || total <= seen) { setShown(total); return; }
    const from = seen, diff = total - from, t0 = performance.now(), dur = Math.min(1200, 400 + diff * 40);
    setGain(diff);
    confetti(ref.current);
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(from + diff * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const hide = setTimeout(() => setGain(0), 2200);
    return () => { cancelAnimationFrame(raf); clearTimeout(hide); };
  }, [total]);

  return (
    <span ref={ref} className="relative inline-block">
      <span className={gain ? "inline-block animate-[cp-pop_600ms_ease-out]" : "inline-block"}>{shown.toLocaleString()} CPs</span>
      {gain > 0 && (
        <span aria-live="polite" className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 animate-[cp-rise_2s_ease-out_forwards] whitespace-nowrap text-[13px] font-semibold text-[#7ee2a8]">+{gain}</span>
      )}
    </span>
  );
}
