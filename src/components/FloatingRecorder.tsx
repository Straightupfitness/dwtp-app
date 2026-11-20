"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_SECONDS = 480;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * November 20 (Michael): record a video reply of just himself (camera and microphone, not the screen) while he keeps
 * scrolling through her check-in, graphs, food and workouts. A small preview of the camera floats in the corner.
 * Then watch it back, redo it, or use it. Uses the camera and microphone he picked before (Elgato or built-in).
 */
export default function FloatingRecorder({ folder, onUploaded, hasVideo }: { folder: string; onUploaded: (path: string | null) => void; hasVideo: boolean }) {
  const live = useRef<HTMLVideoElement>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<"idle" | "ready" | "recording" | "review" | "uploading" | "done">("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  const [big, setBig] = useState(false);

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);
  useEffect(() => {
    if (mode !== "recording") return;
    const t = setInterval(() => setSecs((s) => { if (s + 1 >= MAX_SECONDS) rec.current?.stop(); return s + 1; }), 1000);
    return () => clearInterval(t);
  }, [mode]);
  useEffect(() => {
    const v = live.current;
    if ((mode === "ready" || mode === "recording") && v && stream.current && v.srcObject !== stream.current) { v.srcObject = stream.current; v.play().catch(() => {}); }
  }, [mode]);

  const saved = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
  async function open() {
    setError("");
    const cam = saved("dwtp-cam"), mic = saved("dwtp-mic");
    const video: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, ...(cam ? { deviceId: { exact: cam } } : { facingMode: "user" }) };
    try {
      try { stream.current = await navigator.mediaDevices.getUserMedia({ video, audio: mic ? { deviceId: { exact: mic } } : true }); }
      catch { stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }); }
      setMode("ready");
    } catch { setError("I couldn't open your camera. Allow camera and microphone access in your browser, then try again."); }
  }
  function start() {
    if (!stream.current) return;
    const type = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream.current, { mimeType: type, videoBitsPerSecond: 600_000, audioBitsPerSecond: 64_000 });
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const b = new Blob(chunks.current, { type: r.mimeType || "video/webm" });
      stream.current?.getTracks().forEach((t) => t.stop());
      setBlob(b); setUrl(URL.createObjectURL(b)); setMode("review");
    };
    rec.current = r; setSecs(0); r.start(1000); setMode("recording");
  }
  function cancel() { stream.current?.getTracks().forEach((t) => t.stop()); setMode("idle"); }
  async function upload() {
    if (!blob) return;
    if (blob.size > MAX_BYTES) { setError("That video is over 50 MB. Record a shorter one."); return; }
    setMode("uploading"); setError("");
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const sb = createClient();
    let err: string | null = null;
    for (let i = 0; i < 2; i++) {
      await fetch("/api/auth/keepalive", { cache: "no-store" }).catch(() => {});
      const { error: e } = await sb.storage.from("checkin-videos").upload(path, blob, { contentType: blob.type || "video/webm", upsert: true });
      err = e ? e.message : null;
      if (!e) break;
    }
    if (err) { setError(`Upload failed: ${err}`); setMode("review"); return; }
    setMode("done"); onUploaded(path);
  }

  const btn = "min-h-10 rounded-lg px-3.5 text-[14px] font-semibold";
  return (
    <>
      {(mode === "idle" || mode === "done") && (
        <button type="button" onClick={open} className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-40 min-h-12 rounded-full bg-accent px-5 text-[15px] font-semibold text-black shadow-2xl">
          🎥 {mode === "done" || hasVideo ? "Record again" : "Record yourself"}
        </button>
      )}
      {error && <p className="fixed bottom-[calc(env(safe-area-inset-bottom)+136px)] right-4 z-40 max-w-xs rounded-lg bg-[#2a1515] p-2 text-[13px] text-[#ff9a9a]">{error}</p>}
      {(mode === "ready" || mode === "recording") && (
        <div className={`fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-50 overflow-hidden rounded-2xl border-2 bg-black shadow-2xl ${mode === "recording" ? "border-[#ef4444]" : "border-accent"} ${big ? "w-[420px]" : "w-[260px]"}`}>
          <video ref={live} muted playsInline className="aspect-video w-full -scale-x-100 object-cover" />
          <div className="flex items-center gap-1.5 bg-black/85 p-1.5">
            {mode === "ready" ? <>
              <button type="button" onClick={start} className={`${btn} flex-1 bg-[#ef4444] text-white`}>● Start</button>
              <button type="button" onClick={cancel} className={`${btn} text-dim`}>Cancel</button>
            </> : <>
              <span className="flex items-center gap-1.5 px-1 text-[13px] text-white"><span className="size-2.5 animate-pulse rounded-full bg-[#ef4444]" />{mmss(secs)}</span>
              <button type="button" onClick={() => rec.current?.stop()} className={`${btn} flex-1 bg-white text-black`}>■ Stop</button>
            </>}
            <button type="button" onClick={() => setBig((x) => !x)} aria-label={big ? "Smaller" : "Bigger"} className="min-h-10 px-2 text-white">{big ? "▫" : "□"}</button>
          </div>
        </div>
      )}
      {(mode === "review" || mode === "uploading") && url && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Your video">
          <div className="w-full max-w-xl space-y-3 rounded-2xl border border-border bg-[#121212] p-4">
            <p className="font-[family-name:var(--font-display)] text-lg uppercase">Your video · {mmss(secs)}</p>
            <video src={url} controls playsInline className="w-full rounded-xl bg-black" />
            <div className="flex gap-2">
              <button type="button" disabled={mode === "uploading"} onClick={() => { setBlob(null); setUrl(null); setMode("idle"); }} className={`${btn} flex-1 border border-border`}>Redo</button>
              <button type="button" disabled={mode === "uploading"} onClick={upload} className={`${btn} flex-[2] bg-accent text-black disabled:opacity-50`}>{mode === "uploading" ? "Uploading…" : "Use this video"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
