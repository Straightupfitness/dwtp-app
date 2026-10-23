"use client";
import { useOptimistic, useState, useTransition } from "react";
import { addComment, deleteComment, deletePost, setPinned, toggleLike } from "./actions";

export function LikeButton({ postId, liked, count }: { postId: string; liked: boolean; count: number }) {
  const [s, set] = useOptimistic({ liked, count });
  const [, start] = useTransition();
  return (
    <button type="button" aria-pressed={s.liked} aria-label={s.liked ? "Unlike" : "Like"}
      onClick={() => start(async () => { set({ liked: !s.liked, count: s.count + (s.liked ? -1 : 1) }); await toggleLike(postId, !s.liked); })}
      className={`inline-flex min-h-11 items-center gap-1.5 px-1 text-sm ${s.liked ? "text-accent" : "text-dim"}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill={s.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 21s-7-4.5-9.3-9A5.3 5.3 0 0 1 12 6.5 5.3 5.3 0 0 1 21.3 12C19 16.5 12 21 12 21z" />
      </svg>
      {s.count || ""}
    </button>
  );
}

export function CommentBox({ postId }: { postId: string }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); const b = body; setBody(""); start(() => addComment(postId, b)); }} className="flex gap-2">
      <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment…" aria-label="Write a comment"
        className="min-h-11 flex-1 rounded-lg border border-border bg-bg px-3 text-base outline-none focus:border-accent" />
      <button disabled={pending || !body.trim()} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-accent disabled:opacity-40">Send</button>
    </form>
  );
}

export function DeleteButton({ kind, id }: { kind: "post" | "comment"; id: string }) {
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending}
      onClick={() => (ask ? start(() => (kind === "post" ? deletePost(id) : deleteComment(id))) : setAsk(true))}
      className="min-h-9 px-1 text-xs text-dim">{ask ? "Tap to delete" : "Delete"}</button>
  );
}

export function PinButton({ id, pinned }: { id: string; pinned: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => setPinned(id, !pinned))} className="min-h-9 px-1 text-xs text-dim">
      {pinned ? "Unpin" : "Pin"}
    </button>
  );
}
