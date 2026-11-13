"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PointGroup = { h: string; items: string[] };

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_SECONDS = 480;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * November 13: Michael's video reply with his talking points on screen, like a teleprompter. The camera fills the
 * screen; the bullets sit at the top, close to the lens, so his eyes stay near the camera. Tap the bullets (or
 * ▲ ▼ / space) to move to the next one. Then review, redo or use it. Uploads to `bucket`/`folder`.
 */
export default function PrompterRecorder({ points, bucket, folder, onUploaded, label = "🎥 Record with your talking points", uploadLabel = "Use this video" }: {
  points: PointGroup[]; bucket: "checkin-videos" | "media"; folder: string; onUploaded: (path: string | null) => void; label?: string; uploadLabel?: string;
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
  const [at, setAt] = useState(0);
  const [size, setSize] = useState(20);
  // November 13: pick the camera and microphone (Elgato or the built-in FaceTime camera); remembered on this computer.
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState("");
  const [micId, setMicId] = useState("");
  const [streamKey, setStreamKey] = useState(0);
  const flat = points.flatMap((g) => g.items.map((t) => ({ h: g.h, t })));
  const full = mode === "preview" || mode === "recording";

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);
  useEffect(() => {
    if (mode !== "recording") return;
    const t = setInterval(() => setSecs((s) => { if (s + 1 >= MAX_SECONDS) rec.current?.stop(); return s + 1; }), 1000);
    return () => clearInterval(t);
  }, [mode]);
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); setAt((a) => Math.min(flat.length - 1, a + 1)); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); setAt((a) => Math.max(0, a - 1)); }
    };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", key); };
  }, [full, flat.length]);
  // November 13 (Michael: black screen while recording): connect the camera to the preview after it's rendered.
  useEffect(() => {
    const v = live.current;
    if (!full || !v || !stream.current) return;
    if (v.srcObject !== stream.current) v.srcObject = stream.current;
    v.play().catch(() => {});
  }, [full, mode, streamKey]);
  useEffect(() => { document.getElementById(`pp-${at}`)?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [at]);

  const saved = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
  async function getStream(cam: string, mic: string) {
    const video: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, ...(cam ? { deviceId: { exact: cam } } : { facingMode: "user" }) };
    const audio: MediaTrackConstraints | boolean = mic ? { deviceId: { exact: mic } } : true;
    try { return await navigator.mediaDevices.getUserMedia({ video, audio }); }
    catch (e) {
      // The saved camera or mic isn't plugged in (e.g. the Elgato): fall back to the default ones.
      if (cam || mic) return await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
      throw e;
    }
  }
  async function openCamera(cam = camId || saved("dwtp-cam"), mic = micId || saved("dwtp-mic")) {
    setError("");
    try {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = await getStream(cam, mic);
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
      setCams(devices.filter((d) => d.kind === "videoinput"));
      setMics(devices.filter((d) => d.kind === "audioinput"));
      setCamId(stream.current.getVideoTracks()[0]?.getSettings().deviceId ?? "");
      setMicId(stream.current.getAudioTracks()[0]?.getSettings().deviceId ?? "");
      setStreamKey((k) => k + 1);
      if (mode !== "preview") { setAt(0); setMode("preview"); } // the effect connects the camera once the full-screen view is on the page
    } catch {
      setError("I couldn't open your camera. Allow camera and microphone access in your browser, then try again.");
      setMode("idle");
    }
  }
  function choose(kind: "cam" | "mic", id: string) {
    try { localStorage.setItem(kind === "cam" ? "dwtp-cam" : "dwtp-mic", id); } catch {}
    if (kind === "cam") { setCamId(id); openCamera(id, micId); } else { setMicId(id); openCamera(camId, id); }
  }
  function close() { stream.current?.getTracks().forEach((t) => t.stop()); setMode("idle"); }
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
  function pickFile(f?: File) {
    if (!f) return;
    if (f.size > MAX_BYTES) { setError("That video is over 50 MB. Record it here instead (it's smaller)."); return; }
    setBlob(f); setUrl(URL.createObjectURL(f)); setMode("review");
  }
  async function upload() {
    if (!blob) return;
    if (blob.size > MAX_BYTES) { setError("That video is over 50 MB. Try a shorter one."); return; }
    setMode("uploading"); setError("");
    const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("quicktime") ? "mov" : "webm";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const sb = createClient();
    let err: string | null = null;
    for (let i = 0; i < 2; i++) {
      await fetch("/api/auth/keepalive", { cache: "no-store" }).catch(() => {});
      const { error: e } = await sb.storage.from(bucket).upload(path, blob, { contentType: blob.type || "video/webm", upsert: true });
      err = e ? e.message : null;
      if (!e) break;
    }
    if (err) { setError(`Upload failed: ${err}`); setMode("review"); return; }
    setMode("done"); onUploaded(path);
  }

  const btn = "min-h-11 rounded-lg px-4 font-semibold";
  return (
    <div className="space-y-3 rounded-xl border border-border bg-bg p-3">
      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openCamera()} className={`${btn} bg-accent text-black`}>{label}</button>
          <label className={`${btn} inline-flex cursor-pointer items-center border border-border`}>
            Upload a video
            <input type="file" accept="video/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
          {!flat.length && <p className="w-full text-[12px] text-dim">Tip: get your AI talking points first, and they&apos;ll show on screen while you record.</p>}
        </div>
      )}

      {full && (
        <div className="fixed inset-0 z-[60] bg-black">
          {/* Mirrored like a selfie camera while recording; the saved video isn't mirrored. */}
          <video ref={live} muted autoPlay playsInline className="absolute inset-0 size-full object-cover" style={{ transform: "scaleX(-1)" }} />
          {flat.length > 0 && (
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 via-black/70 to-transparent pb-10 pt-[max(env(safe-area-inset-top),12px)]">
              <div className="mx-auto max-h-[38dvh] max-w-3xl overflow-y-auto px-4 [scrollbar-width:none]" onClick={() => setAt((a) => Math.min(flat.length - 1, a + 1))}>
                {flat.map((p, i) => (
                  <div key={i} id={`pp-${i}`} className={`py-1.5 transition-opacity ${i === at ? "opacity-100" : i < at ? "opacity-30" : "opacity-55"}`}>
                    {p.h && (i === 0 || flat[i - 1].h !== p.h) && <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">{p.h}</p>}
                    <p className="font-semibold leading-snug text-white" style={{ fontSize: i === at ? size : size * 0.8 }}>{i === at ? "▶ " : ""}{p.t}</p>
                  </div>
                ))}
              </div>
              <div className="mx-auto mt-1 flex max-w-3xl items-center justify-between px-4 text-[12px] text-white/70">
                <span>{at + 1} / {flat.length} · tap the words for the next one</span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => setAt((a) => Math.max(0, a - 1))} className="grid size-9 place-items-center rounded-full bg-white/15" aria-label="Previous point">▲</button>
                  <button type="button" onClick={() => setAt((a) => Math.min(flat.length - 1, a + 1))} className="grid size-9 place-items-center rounded-full bg-white/15" aria-label="Next point">▼</button>
                  <button type="button" onClick={() => setSize((s) => Math.max(14, s - 2))} className="grid size-9 place-items-center rounded-full bg-white/15" aria-label="Smaller text">A−</button>
                  <button type="button" onClick={() => setSize((s) => Math.min(34, s + 2))} className="grid size-9 place-items-center rounded-full bg-white/15" aria-label="Bigger text">A+</button>
                </span>
              </div>
            </div>
          )}
          {mode === "preview" && (cams.length > 1 || mics.length > 1) && (
            <div className="absolute inset-x-0 bottom-[120px] mx-auto flex max-w-md flex-wrap justify-center gap-2 px-4">
              {cams.length > 1 && (
                <select value={camId} onChange={(e) => choose("cam", e.target.value)} aria-label="Camera"
                  className="min-h-10 max-w-[48%] flex-1 rounded-full border border-white/20 bg-black/70 px-3 text-[13px] text-white">
                  {cams.map((d, i) => <option key={d.deviceId} value={d.deviceId}>📷 {d.label || `Camera ${i + 1}`}</option>)}
                </select>
              )}
              {mics.length > 1 && (
                <select value={micId} onChange={(e) => choose("mic", e.target.value)} aria-label="Microphone"
                  className="min-h-10 max-w-[48%] flex-1 rounded-full border border-white/20 bg-black/70 px-3 text-[13px] text-white">
                  {mics.map((d, i) => <option key={d.deviceId} value={d.deviceId}>🎙 {d.label || `Microphone ${i + 1}`}</option>)}
                </select>
              )}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent pb-[max(env(safe-area-inset-bottom),20px)] pt-10">
            {mode === "preview" ? (
              <>
                <button type="button" onClick={close} className="min-h-11 rounded-full bg-white/15 px-4 text-[14px] text-white">Cancel</button>
                <button type="button" onClick={start} className="grid size-[72px] place-items-center rounded-full border-4 border-white" aria-label="Start recording"><span className="size-14 rounded-full bg-[var(--red)]" /></button>
                <span className="w-[76px]" />
              </>
            ) : (
              <>
                <span className="w-[76px] text-right text-[15px] font-semibold text-white">● {mmss(secs)}</span>
                <button type="button" onClick={() => rec.current?.stop()} className="grid size-[72px] place-items-center rounded-full border-4 border-white" aria-label="Stop recording"><span className="size-7 rounded-md bg-[var(--red)]" /></button>
                <span className="w-[76px] text-[12px] text-white/60">max {mmss(MAX_SECONDS)}</span>
              </>
            )}
          </div>
        </div>
      )}

      {(mode === "review" || mode === "uploading") && url && (
        <>
          <video src={url} controls playsInline className="max-h-[60dvh] w-full rounded-lg bg-black" />
          <div className="flex gap-2">
            <button type="button" disabled={mode === "uploading"} onClick={() => { setBlob(null); setUrl(null); setMode("idle"); onUploaded(null); }} className={`${btn} border border-border`}>Redo</button>
            <button type="button" disabled={mode === "uploading"} onClick={upload} className={`${btn} flex-1 bg-accent text-black disabled:opacity-50`}>{mode === "uploading" ? "Uploading…" : uploadLabel}</button>
          </div>
        </>
      )}
      {mode === "done" && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">Video ready ✓</p>
          <button type="button" onClick={() => { setMode("idle"); setBlob(null); setUrl(null); onUploaded(null); }} className="text-sm text-dim underline">Replace it</button>
        </div>
      )}
      {error && <p className="text-sm text-[var(--red)]">{error}</p>}
    </div>
  );
}

/** "## Heading" and "- bullet" lines (the check-in talking points) as groups for the prompter. */
export function groupsFromText(text: string): PointGroup[] {
  const out: PointGroup[] = [];
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    const h = l.match(/^#{1,4}\s*(.+)$/) ?? l.match(/^\*\*(.+)\*\*:?$/);
    if (h) { out.push({ h: h[1].replace(/:$/, ""), items: [] }); continue; }
    if (!out.length) out.push({ h: "", items: [] });
    out[out.length - 1].items.push(l.replace(/^[-*•]\s*/, ""));
  }
  return out.filter((g) => g.items.length);
}
