"use client";
import { useOptimistic, useTransition } from "react";
import { toggleHeart, toggleLike } from "./actions";

/** The ♥ under the other person's message: tap to love it (or double-tap the bubble). */
export function HeartButton({ id, hearted }: { id: string; hearted: boolean }) {
  const [on, setOn] = useOptimistic(hearted);
  const [, start] = useTransition();
  return (
    <button type="button" aria-pressed={on} aria-label={on ? "Remove love" : "Love"}
      onClick={() => start(async () => { setOn(!on); await toggleHeart(id); })}
      className={`grid size-8 shrink-0 place-items-center self-end rounded-full ${on ? "text-[#fb7185]" : "text-[#5a5a5a] hover:text-[#a8a8a8]"}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
    </button>
  );
}

/** November 15: 👍 next to the ♥. */
export function LikeButton({ id, liked }: { id: string; liked: boolean }) {
  const [on, setOn] = useOptimistic(liked);
  const [, start] = useTransition();
  return (
    <button type="button" aria-pressed={on} aria-label={on ? "Remove like" : "Like"}
      onClick={() => start(async () => { setOn(!on); await toggleLike(id); })}
      className={`grid size-8 shrink-0 place-items-center self-end rounded-full ${on ? "text-[#60a5fa]" : "text-[#5a5a5a] hover:text-[#a8a8a8]"}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 10v10H4V10h3zm0 0 4-7c1.5 0 2.5 1 2.2 2.6L12.6 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7" />
      </svg>
    </button>
  );
}
