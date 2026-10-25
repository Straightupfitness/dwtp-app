"use client";
import { useOptimistic, useState, useTransition } from "react";
import { addComment, deleteComment, deletePost, setPinned, toggleCommentLike, toggleLike } from "./actions";

const Heart = ({ on, size = 20 }: { on: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M12 21s-7-4.5-9.3-9A5.3 5.3 0 0 1 12 6.5 5.3 5.3 0 0 1 21.3 12C19 16.5 12 21 12 21z" />
  </svg>
);

export function LikeButton({ postId, liked, count }: { postId: string; liked: boolean; count: number }) {
  const [s, set] = useOptimistic({ liked, count });
  const [, start] = useTransition();
  return (
    <button type="button" aria-pressed={s.liked} aria-label={s.liked ? "Unlike" : "Like"}
      onClick={() => start(async () => { set({ liked: !s.liked, count: s.count + (s.liked ? -1 : 1) }); await toggleLike(postId, !s.liked); })}
      className={`inline-flex min-h-11 items-center gap-1.5 px-1 text-sm ${s.liked ? "text-accent" : "text-dim"}`}>
      <Heart on={s.liked} />{s.count || ""}
    </button>
  );
}

export function CommentLike({ commentId, liked, count }: { commentId: string; liked: boolean; count: number }) {
  const [s, set] = useOptimistic({ liked, count });
  const [, start] = useTransition();
  return (
    <button type="button" aria-pressed={s.liked} aria-label={s.liked ? "Unlike comment" : "Like comment"}
      onClick={() => start(async () => { set({ liked: !s.liked, count: s.count + (s.liked ? -1 : 1) }); await toggleCommentLike(commentId, !s.liked); })}
      className={`inline-flex min-h-9 items-center gap-1 text-xs font-semibold ${s.liked ? "text-accent" : "text-dim"}`}>
      <Heart on={s.liked} size={14} />{s.liked ? "Liked" : "Like"}{s.count ? ` · ${s.count}` : ""}
    </button>
  );
}

/** "Reply" under a comment opens a small box; on a post it's the main comment box. */
export function CommentBox({ postId, parentId = null, replyTo, compact = false }: { postId: string; parentId?: string | null; replyTo?: string; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [body, setBody] = useState(replyTo ? `@${replyTo} ` : "");
  const [pending, start] = useTransition();
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-9 text-xs font-semibold text-dim">Reply</button>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); const b = body; setBody(""); if (compact) setOpen(false); start(() => addComment(postId, b, parentId)); }} className="flex w-full gap-2">
      <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={parentId ? "Write a reply…" : "Write a comment…"} aria-label={parentId ? "Write a reply" : "Write a comment"}
        autoFocus={compact} className="min-h-11 flex-1 rounded-full border border-[#2a2a2a] bg-bg px-4 text-[15px] outline-none focus:border-accent" />
      <button disabled={pending || !body.trim()} className="min-h-11 rounded-full px-3 text-sm font-semibold text-accent disabled:opacity-40">Send</button>
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
