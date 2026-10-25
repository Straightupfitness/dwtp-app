"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import { createPost } from "./actions";

export default function Composer({ userId, coach }: { userId: string; coach: boolean }) {
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post() {
    setBusy(true); setError("");
    let path: string | null = null;
    if (photo) {
      path = `posts/${userId}/${crypto.randomUUID()}.jpg`;
      const { error: e } = await createClient().storage.from("media").upload(path, photo, { contentType: "image/jpeg" });
      if (e) { setError(`Photo upload failed: ${e.message}`); setBusy(false); return; }
    }
    const r = await createPost(body, path, pinned);
    setBusy(false);
    if (r?.error) { setError(r.error); return; }
    setBody(""); setPhoto(null); setPreview(null); setPinned(false);
  }

  return (
    <div className="space-y-2 rounded-[18px] border border-border bg-card p-3">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Share a win, a meal, a question…" aria-label="Write a post"
        className="w-full resize-none rounded-lg bg-transparent p-1 text-base outline-none" />
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
      {preview && <img src={preview} alt="" className="max-h-64 rounded-lg" />}
      <div className="flex items-center gap-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-dim">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 17l-5-5-8 8" /></svg>
          Photo
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return; const s = await shrinkImage(f); setPhoto(s); setPreview(URL.createObjectURL(s));
          }} />
        </label>
        {coach && (
          <label className="inline-flex items-center gap-1.5 text-sm text-dim">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="size-4 accent-[var(--accent)]" /> Pin to top
          </label>
        )}
        <button type="button" disabled={busy || (!body.trim() && !photo)} onClick={post}
          className="ml-auto min-h-11 rounded-lg bg-accent px-5 font-semibold text-black disabled:opacity-40">{busy ? "Posting…" : "Post"}</button>
      </div>
      {error && <p className="text-sm text-[var(--red)]">{error}</p>}
    </div>
  );
}
