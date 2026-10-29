"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import { useDictation } from "@/lib/useDictation";
import { editMessage, markRead, sendMessage } from "./actions";
import { EDIT_EVENT, REPLY_EVENT, type EditMsg, type ReplyTo } from "./Bubble";

const ICON = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const Photo = () => <svg {...ICON}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 17l-5-5-8 8" /></svg>;
const Mic = () => <svg {...ICON}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
const Wave = () => <svg {...ICON}><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" /></svg>;
const Send = () => <svg {...ICON} strokeWidth={2.2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** A voice note recorder: the format each phone can play back (iPhone records MP4/AAC, Chrome WebM/Opus). */
function pickType() {
  if (typeof MediaRecorder === "undefined") return null;
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/**
 * The chat box (October 29): photos, dictation (speak, it types), voice notes (record and send the audio),
 * replying to a message and editing your own.
 */
export default function ChatComposer({ clientId, unread }: { clientId: string; unread: number }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState<ReplyTo | null>(null);
  const [editing, setEditing] = useState<EditMsg | null>(null);
  const [rec, setRec] = useState<{ started: number; secs: number } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation(setBody);

  useEffect(() => { if (unread) markRead(clientId); }, [clientId, unread]);
  useEffect(() => { window.scrollTo({ top: document.body.scrollHeight }); }, []);
  useEffect(() => {
    const onReply = (e: Event) => { setEditing(null); setReply((e as CustomEvent<ReplyTo>).detail); box.current?.focus(); };
    const onEdit = (e: Event) => { const m = (e as CustomEvent<EditMsg>).detail; setReply(null); setEditing(m); setBody(m.body); box.current?.focus(); };
    window.addEventListener(REPLY_EVENT, onReply); window.addEventListener(EDIT_EVENT, onEdit);
    return () => { window.removeEventListener(REPLY_EVENT, onReply); window.removeEventListener(EDIT_EVENT, onEdit); };
  }, []);
  // Recording timer.
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setRec((r) => (r ? { ...r, secs: Math.floor((performance.now() - r.started) / 1000) } : r)), 250);
    return () => clearInterval(t);
  }, [rec]);

  const bottom = () => setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 300);

  async function upload(blob: Blob, ext: string, type: string) {
    const path = `chat/${clientId}/${crypto.randomUUID()}.${ext}`;
    const { error: e } = await createClient().storage.from("media").upload(path, blob, { contentType: type });
    if (e) throw new Error(e.message);
    return path;
  }

  async function send(photo?: File) {
    if (dictation.listening) dictation.toggle(body);
    setBusy(true); setError("");
    if (editing && !photo) {
      const r = await editMessage(editing.id, body);
      setBusy(false);
      if (r?.error) setError(r.error); else { setEditing(null); setBody(""); }
      return;
    }
    let path: string | null = null;
    if (photo) {
      try { path = await upload(await shrinkImage(photo), "jpg", "image/jpeg"); }
      catch (e) { setError(`Photo upload failed: ${(e as Error).message}`); setBusy(false); return; }
    }
    const text = photo ? "" : body;
    if (!photo) setBody("");
    const r = await sendMessage(clientId, text, path, { kind: photo ? "image" : undefined, replyTo: reply?.id ?? null });
    setBusy(false);
    if (r?.error) { setError(r.error); if (!photo) setBody(text); } else setReply(null);
    bottom();
  }

  async function startVoice() {
    setError("");
    const type = pickType();
    if (type === null || !navigator.mediaDevices?.getUserMedia) { setError("Voice notes don't work in this browser. Try dictation (the mic) instead."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = []; cancelled.current = false;
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const secs = Math.max(1, Math.round((performance.now() - (startedAt.current ?? performance.now())) / 1000));
        setRec(null);
        if (cancelled.current || !chunks.current.length) return;
        const mime = r.mimeType || type || "audio/webm";
        const blob = new Blob(chunks.current, { type: mime });
        setBusy(true);
        try {
          const path = await upload(blob, mime.includes("mp4") ? "m4a" : "webm", mime.split(";")[0]);
          const res = await sendMessage(clientId, "", path, { kind: "audio", replyTo: reply?.id ?? null, seconds: secs });
          if (res?.error) setError(res.error); else setReply(null);
        } catch (e) { setError(`Voice note didn't send: ${(e as Error).message}`); }
        setBusy(false);
        bottom();
      };
      recorder.current = r;
      startedAt.current = performance.now();
      r.start();
      setRec({ started: startedAt.current, secs: 0 });
    } catch { setError("Allow the microphone to record a voice note (your browser asked, or check its settings)."); }
  }
  const startedAt = useRef<number | null>(null);
  function stopVoice(cancel: boolean) { cancelled.current = cancel; recorder.current?.stop(); }

  const round = "grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full";
  return (
    <div className="fixed inset-x-0 z-10 bottom-[calc(env(safe-area-inset-bottom)+57px)] border-t border-border bg-bg/95 px-4 py-2 backdrop-blur">
      <div className="mx-auto max-w-md space-y-1.5">
        {(reply || editing) && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-[13px]">
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-accent">{editing ? "Editing your message" : `Replying to ${reply!.who}`}</span>
              {reply && <span className="block truncate text-dim">{reply.snippet}</span>}
            </span>
            <button type="button" onClick={() => { setReply(null); if (editing) { setEditing(null); setBody(""); } }} aria-label="Cancel" className="min-h-9 px-2 text-dim">✕</button>
          </div>
        )}

        {rec ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => stopVoice(true)} className="min-h-11 rounded-full border border-border px-4 text-sm text-dim">Cancel</button>
            <span className="flex flex-1 items-center gap-2 text-[15px]"><span className="size-2.5 animate-pulse rounded-full bg-[#ef4444]" />Recording {mmss(rec.secs)}</span>
            <button type="button" onClick={() => stopVoice(false)} aria-label="Send voice note" className={`${round} bg-accent text-black`}><Send /></button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) send(); }} className="flex items-end gap-1.5">
            {!editing && (
              <label className={`${round} cursor-pointer border border-border text-dim`} aria-label="Send a photo">
                <Photo />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }} />
              </label>
            )}
            <span className="relative flex-1">
              <textarea ref={box} value={body} onChange={(e) => setBody(e.target.value)} rows={1} placeholder={dictation.listening ? "Listening… speak now" : "Message…"} aria-label="Message"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && body.trim()) { e.preventDefault(); send(); } }}
                className="block max-h-32 min-h-11 w-full resize-none rounded-2xl border border-border bg-card py-2.5 pl-4 pr-11 text-base outline-none focus:border-accent" />
              {/* Dictation: speak and it types. */}
              <button type="button" onClick={() => dictation.toggle(body)} aria-label={dictation.listening ? "Stop dictation" : "Dictate (speak to type)"} aria-pressed={dictation.listening}
                className={`absolute bottom-1 right-1 grid size-9 place-items-center rounded-full ${dictation.listening ? "bg-[#ef4444] text-white" : "text-dim"}`}><Mic /></button>
            </span>
            {body.trim() || editing
              ? <button disabled={busy || !body.trim()} aria-label={editing ? "Save changes" : "Send"} className={`${round} bg-accent text-black disabled:opacity-40`}>{editing ? <span className="text-[12px] font-bold">Save</span> : <Send />}</button>
              : <button type="button" disabled={busy} onClick={startVoice} aria-label="Record a voice note" className={`${round} border border-accent text-accent disabled:opacity-40`}><Wave /></button>}
          </form>
        )}
        {(error || dictation.error) && <p className="text-sm text-[var(--red)]">{error || dictation.error}</p>}
        {busy && !rec && <p className="text-xs text-dim">Sending…</p>}
      </div>
    </div>
  );
}
