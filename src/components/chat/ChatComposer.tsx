"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import { markRead, sendMessage } from "./actions";

export default function ChatComposer({ clientId, unread }: { clientId: string; unread: number }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (unread) markRead(clientId); }, [clientId, unread]);
  useEffect(() => { window.scrollTo({ top: document.body.scrollHeight }); }, []);

  async function send(photo?: File) {
    setBusy(true); setError("");
    let path: string | null = null;
    if (photo) {
      const small = await shrinkImage(photo);
      path = `chat/${clientId}/${crypto.randomUUID()}.jpg`;
      const { error: e } = await createClient().storage.from("media").upload(path, small, { contentType: "image/jpeg" });
      if (e) { setError(`Photo upload failed: ${e.message}`); setBusy(false); return; }
    }
    const text = photo ? "" : body;
    if (!photo) setBody("");
    const r = await sendMessage(clientId, text, path);
    setBusy(false);
    if (r?.error) { setError(r.error); if (!photo) setBody(text); }
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 300);
  }

  return (
    <div className="fixed inset-x-0 z-10 bottom-[calc(env(safe-area-inset-bottom)+57px)] border-t border-border bg-bg/95 px-4 py-2 backdrop-blur">
      <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) send(); }} className="mx-auto flex max-w-md items-end gap-2">
        <label className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full border border-border text-dim" aria-label="Send a photo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 17l-5-5-8 8" /></svg>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }} />
        </label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={1} placeholder="Message Michael…" aria-label="Message"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && body.trim()) { e.preventDefault(); send(); } }}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-2.5 text-base outline-none focus:border-accent" />
        <button disabled={busy || !body.trim()} aria-label="Send" className="grid min-h-11 min-w-11 place-items-center rounded-full bg-accent text-black disabled:opacity-40">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
      {error && <p className="mx-auto max-w-md pt-1 text-sm text-[var(--red)]">{error}</p>}
    </div>
  );
}
