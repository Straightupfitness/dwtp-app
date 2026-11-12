"use client";
import { useState, useTransition } from "react";
import Linkify from "@/components/Linkify";
import { editPost } from "./actions";

/** A post's words, with Edit for whoever wrote it (November 11). */
export default function PostBody({ id, body, canEdit }: { id: string; body: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(body);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  if (editing) return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(12, Math.max(3, text.split("\n").length + 1))} autoFocus aria-label="Edit your post"
        className="w-full rounded-xl border border-[#2a2a2a] bg-bg p-3 text-[15px] leading-relaxed outline-none focus:border-accent" />
      {err && <p className="text-sm text-[var(--red)]">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setEditing(false); setText(body); setErr(""); }} className="min-h-10 px-3 text-sm text-dim">Cancel</button>
        <button type="button" disabled={pending || text.trim() === body.trim()} onClick={() => start(async () => { const r = await editPost(id, text); if (r?.error) setErr(r.error); else setEditing(false); })}
          className="min-h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-black disabled:opacity-40">{pending ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
  return (
    <div>
      {body && <p className="whitespace-pre-line text-[15px] leading-relaxed"><Linkify text={body} /></p>}
      {canEdit && <button type="button" onClick={() => { setText(body); setEditing(true); }} className="min-h-9 text-xs font-semibold text-dim">{body ? "Edit" : "Add a caption"}</button>}
    </div>
  );
}
