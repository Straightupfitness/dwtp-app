"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendVideoReply } from "@/app/(app)/coach/followups/actions";

const MAX_SECONDS = 360; // 6 minutes keeps a screen recording under the 50 MB upload limit
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * November 15 (Michael): record his screen while he goes through her page (food logs, Blueprint answers…), with his
 * camera in a bubble in the corner and his microphone, then send the video to her chat. Needs a computer browser
 * (Chrome, Edge or Safari on a Mac); phones can't record the screen from a web page.
 */
export default function PageRecorder({ clientId, first }: { clientId: string; first: string }) {
  const [supported, setSupported] = useState(false);
  const [mode, setMode] = useState<"idle" | "recording" | "review" | "uploading" | "sent">("idle");
  const [secs, setSecs] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [note, setNote] = useState(`Hi ${first}, here's a reply to `);
  const [err, setErr] = useState("");
  const [camOn, setCamOn] = useState(true);
  const cam = useRef<HTMLVideoElement>(null);
  const streams = useRef<MediaStream[]>([]);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- checking what this browser can do, once
  useEffect(() => { setSupported(typeof navigator !== "undefined" && !!navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices); }, []);
  useEffect(() => {
    if (mode !== "recording") return;
    const t = setInterval(() => setSecs((s) => { if (s + 1 >= MAX_SECONDS) rec.current?.stop(); return s + 1; }), 1000);
    return () => clearInterval(t);
  }, [mode]);
  useEffect(() => () => streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop())), []);

  async function start() {
    setErr("");
    try {
      // This tab (Chrome offers it first), his microphone, and his camera for the bubble.
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 24, width: { ideal: 1600 }, height: { ideal: 1000 } }, audio: false,
        ...({ preferCurrentTab: true, selfBrowserSurface: "include" } as object),
      } as DisplayMediaStreamOptions);
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: camOn ? { width: 320, height: 320, facingMode: "user" } : false });
      streams.current = [screen, mic];
      if (camOn && cam.current) { cam.current.srcObject = new MediaStream(mic.getVideoTracks()); cam.current.play().catch(() => {}); }
      const mixed = new MediaStream([...screen.getVideoTracks(), ...mic.getAudioTracks()]);
      const type = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(mixed, { mimeType: type, videoBitsPerSecond: 900_000, audioBitsPerSecond: 64_000 });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
        const b = new Blob(chunks.current, { type: r.mimeType || "video/webm" });
        setBlob(b); setUrl(URL.createObjectURL(b)); setMode("review");
      };
      screen.getVideoTracks()[0].addEventListener("ended", () => { if (r.state === "recording") r.stop(); }); // "Stop sharing" in the browser
      rec.current = r; setSecs(0); r.start(1000); setMode("recording");
    } catch {
      streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      setErr("Recording didn't start. Allow screen, camera and microphone access, and pick this tab when the browser asks.");
    }
  }

  async function send() {
    if (!blob) return;
    if (blob.size > 50 * 1024 * 1024) { setErr("That recording is over 50 MB. Record a shorter one (under 6 minutes)."); return; }
    setMode("uploading"); setErr("");
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const path = `chat/${clientId}/${crypto.randomUUID()}.${ext}`;
    await fetch("/api/auth/keepalive", { cache: "no-store" }).catch(() => {});
    const { error } = await createClient().storage.from("media").upload(path, blob, { contentType: blob.type || "video/webm" });
    if (error) { setErr(`Upload failed: ${error.message}`); setMode("review"); return; }
    const r = await sendVideoReply(clientId, path, note);
    if (r?.error) { setErr(r.error); setMode("review"); return; }
    setMode("sent");
  }

  if (!supported) return null;
  return (
    <>
      {mode === "idle" && (
        <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-accent pr-3">
          <button type="button" onClick={start} className="inline-flex min-h-10 items-center px-3 text-[13px] font-semibold text-accent">🎥 Record while you review</button>
          <label className="flex items-center gap-1 text-[12px] text-dim"><input type="checkbox" checked={camOn} onChange={(e) => setCamOn(e.target.checked)} className="accent-[var(--accent)]" />camera bubble</label>
        </span>
      )}
      {mode === "sent" && <span className="text-[13px] text-[#7ddc8f]">✓ Video sent to {first}&apos;s chat <button type="button" onClick={() => { setMode("idle"); setBlob(null); setUrl(null); }} className="ml-1 underline">record another</button></span>}
      {err && mode !== "review" && <span className="text-[12px] text-[var(--red)]">{err}</span>}

      {/* While recording: a small bar at the top, and his camera bubble bottom-right (both end up in the video). */}
      {mode === "recording" && (
        <div className="fixed left-1/2 top-3 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/85 px-4 py-2 text-[13px] text-white shadow-lg">
          <span className="font-semibold text-[#ff6b6b]">● {mmss(secs)}</span><span className="text-white/60">max {mmss(MAX_SECONDS)}</span>
          <button type="button" onClick={() => rec.current?.stop()} className="rounded-full bg-[#b3261e] px-3 py-1 font-semibold">Stop</button>
        </div>
      )}
      <video ref={cam} muted playsInline aria-hidden="true"
        className={`fixed bottom-24 right-4 z-[70] size-40 rounded-full border-4 border-accent bg-black object-cover shadow-2xl ${mode === "recording" && camOn ? "" : "hidden"}`} style={{ transform: "scaleX(-1)" }} />

      {(mode === "review" || mode === "uploading") && url && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Your recording">
          <div className="w-full max-w-2xl space-y-3 rounded-[20px] border border-border bg-[#121212] p-4">
            <p className="font-[family-name:var(--font-display)] text-xl uppercase">Send it to {first}?</p>
            <video src={url} controls playsInline className="max-h-[55dvh] w-full rounded-xl bg-black" />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="A line of text with your video"
              className="w-full rounded-xl border border-border bg-card p-3 text-[15px] outline-none focus:border-accent" />
            {err && <p className="text-sm text-[var(--red)]">{err}</p>}
            <div className="flex gap-2">
              <button type="button" disabled={mode === "uploading"} onClick={() => { setMode("idle"); setBlob(null); setUrl(null); setErr(""); }} className="min-h-11 flex-1 rounded-xl border border-border text-[14px]">Discard</button>
              <button type="button" disabled={mode === "uploading"} onClick={send} className="min-h-11 flex-[2] rounded-xl bg-accent text-[14px] font-semibold text-black disabled:opacity-50">{mode === "uploading" ? "Sending…" : `Send to ${first}'s chat`}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
