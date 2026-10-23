"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Record a video in the app (front camera, ~1 Mbps so 5 minutes is ~40 MB), or upload one.
 * Uploads to the private checkin-videos bucket under folder/, and reports the stored path.
 */
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_SECONDS = 300;

export default function VideoRecorder({ folder, onUploaded, label = "Record your video" }: {
  folder: string; onUploaded: (path: string | null) => void; label?: string;
}) {
  const live = useRef<HTMLVideoElement>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<"idle" | "preview" | "recording" | "review" | "uploading" | "done">("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);
  useEffect(() => {
    if (mode !== "recording") return;
    const t = setInterval(() => setSecs((s) => { if (s + 1 >= MAX_SECONDS) rec.current?.stop(); return s + 1; }), 1000);
    return () => clearInterval(t);
  }, [mode]);

  async function openCamera() {
    setError("");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 } }, audio: true });
      setMode("preview");
      setTimeout(() => { if (live.current) { live.current.srcObject = stream.current; live.current.play(); } }, 0);
    } catch {
      setError("I couldn't open your camera. Allow camera access, or upload a video instead.");
    }
  }

  function start() {
    if (!stream.current) return;
    const type = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream.current, { mimeType: type, videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 64_000 });
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const b = new Blob(chunks.current, { type: r.mimeType || "video/webm" });
      stream.current?.getTracks().forEach((t) => t.stop());
      setBlob(b); setUrl(URL.createObjectURL(b)); setMode("review");
    };
    rec.current = r; setSecs(0); r.start(1000); setMode("recording");
  }

  function pickFile(f?: File) {
    if (!f) return;
    if (f.size > MAX_BYTES) { setError("That video is over 50 MB. Record it here in the app instead (it's smaller), or keep it under about 2 minutes."); return; }
    setBlob(f); setUrl(URL.createObjectURL(f)); setMode("review");
  }

  async function upload() {
    if (!blob) return;
    if (blob.size > MAX_BYTES) { setError("That video is over 50 MB. Try a shorter one."); return; }
    setMode("uploading"); setError("");
    const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("quicktime") ? "mov" : "webm";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error: e } = await createClient().storage.from("checkin-videos").upload(path, blob, { contentType: blob.type || "video/webm" });
    if (e) { setError(`Upload failed: ${e.message}`); setMode("review"); return; }
    setMode("done"); onUploaded(path);
  }

  const btn = "min-h-11 rounded-lg px-4 font-semibold";
  return (
    <div className="space-y-3 rounded-xl border border-border bg-bg p-3">
      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openCamera} className={`${btn} bg-accent text-black`}>{label}</button>
          <label className={`${btn} inline-flex cursor-pointer items-center border border-border`}>
            Upload a video
            <input type="file" accept="video/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
        </div>
      )}
      {(mode === "preview" || mode === "recording") && (
        <>
          <video ref={live} muted playsInline className="w-full rounded-lg bg-black" />
          <div className="flex items-center gap-3">
            {mode === "preview"
              ? <button type="button" onClick={start} className={`${btn} bg-[var(--red)] text-white`}>Start recording</button>
              : <button type="button" onClick={() => rec.current?.stop()} className={`${btn} bg-text text-black`}>Stop</button>}
            {mode === "recording" && <span className="text-sm text-dim">● {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} / 5:00</span>}
          </div>
        </>
      )}
      {(mode === "review" || mode === "uploading") && url && (
        <>
          <video src={url} controls playsInline className="w-full rounded-lg bg-black" />
          <div className="flex gap-2">
            <button type="button" disabled={mode === "uploading"} onClick={() => { setBlob(null); setUrl(null); setMode("idle"); onUploaded(null); }}
              className={`${btn} border border-border`}>Redo</button>
            <button type="button" disabled={mode === "uploading"} onClick={upload} className={`${btn} flex-1 bg-accent text-black disabled:opacity-50`}>
              {mode === "uploading" ? "Uploading…" : "Use this video"}
            </button>
          </div>
        </>
      )}
      {mode === "done" && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">Video saved.</p>
          <button type="button" onClick={() => { setMode("idle"); setBlob(null); setUrl(null); onUploaded(null); }} className="text-sm text-dim underline">Replace it</button>
        </div>
      )}
      {error && <p className="text-sm text-[var(--red)]">{error}</p>}
    </div>
  );
}
