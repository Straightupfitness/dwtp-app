"use client";
import { useOptimistic, useTransition } from "react";
import { toggleHeart } from "./actions";

/** The ♥ under the other person's message: tap to like it (or double-tap the bubble). */
export function HeartButton({ id, hearted }: { id: string; hearted: boolean }) {
  const [on, setOn] = useOptimistic(hearted);
  const [, start] = useTransition();
  return (
    <button type="button" aria-pressed={on} aria-label={on ? "Unlike" : "Like"}
      onClick={() => start(async () => { setOn(!on); await toggleHeart(id); })}
      className={`grid size-8 shrink-0 place-items-center self-end rounded-full ${on ? "text-[#fb7185]" : "text-[#5a5a5a] hover:text-[#a8a8a8]"}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
    </button>
  );
}
