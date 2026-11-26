"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { registerVideo } from "../actions";
import type { Script } from "@/lib/medal-scripts";

type Mode = "setup" | "countdown" | "recording" | "review" | "uploading";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const saved = (k: string, d = "") => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const keep = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
const MP4 = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/mp4"];

/**
 * November 21 (Michael): a teleprompter on his laptop. The script scrolls in big letters at the top of the screen,
 * right under the webcam, so his eyes stay near the lens. Record → watch it back → "Upload as MED-51" puts it on its
 * medal (program-videos/MED-51.mp4), then straight on to the next script. Recorded vertical (9:16) by default so it
 * matches his phone videos. Space pauses the scroll; ↑ ↓ nudge it.
 */
export type ScriptSet = { key: string; label: string };

/**
 * November 26 (Michael): a "Prompter view" for his Elgato Prompter (its screen sits in front of the Sony ZV-1, which
 * the computer sees as a webcam). Drag this window onto the Prompter's screen: the script fills it in big, left-aligned
 * text, the camera shrinks to a small framing preview, and the controls fold into one slim row. "Mirror" flips the
 * text in case the glass shows it backwards. The script sets: medals and Habits & Homework.
 */
export default function Teleprompter({ scripts, uploaded, start, set, sets }: { scripts: Record<string, Script>; uploaded: string[]; start: string; set: string; sets: ScriptSet[] }) {
  const codes = Object.keys(scripts);
  const [code, setCode] = useState(start);
  const [done, setDone] = useState<Set<string>>(() => new Set(uploaded));
  const [mode, setMode] = useState<Mode>("setup");
  const [count, setCount] = useState(3);
  const [secs, setSecs] = useState(0);
  const [wpm, setWpm] = useState(() => Number(saved("dwtp-tp-wpm", "150")) || 150);
  const [size, setSize] = useState(() => Number(saved("dwtp-tp-size", "40")) || 40);
  // Medals are vertical like his phone videos; Habits & Homework were shot horizontal (HH-01 to HH-04). Remembered per set.
  const vKey = `dwtp-tp-vertical-${set}`;
  const [vertical, setVertical] = useState(() => saved(vKey, set === "hh" ? "0" : "1") === "1");
  const [paused, setPaused] = useState(false);
  const [pv, setPv] = useState(() => saved("dwtp-tp-prompter") === "1");
  const [mirror, setMirror] = useState(() => saved("dwtp-tp-mirror") === "1");
  const [pvSize, setPvSize] = useState(() => Number(saved("dwtp-tp-pvsize", "52")) || 52);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState(() => saved("dwtp-cam"));
  const [micId, setMicId] = useState(() => saved("dwtp-mic"));
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const live = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  const s = scripts[code];
  const text = s.text.replace(/\*/g, "");
  const words = text.split(/\s+/).length;
  const at = codes.indexOf(code);

  // The camera, with the chosen devices (remembered on this computer, shared with the other recorders).
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        stream.current?.getTracks().forEach((t) => t.stop());
        const st = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, ...(camId ? { deviceId: { exact: camId } } : { facingMode: "user" }) },
          audio: micId ? { deviceId: { exact: micId }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true },
        });
        if (stop) { st.getTracks().forEach((t) => t.stop()); return; }
        stream.current = st;
        if (live.current) { live.current.srcObject = st; live.current.play().catch(() => {}); }
        const all = await navigator.mediaDevices.enumerateDevices();
        setCams(all.filter((d) => d.kind === "videoinput")); setMics(all.filter((d) => d.kind === "audioinput"));
        setErr("");
      } catch { setErr("I couldn't open your camera. Allow camera and microphone access for this site, then reload."); }
    })();
    return () => { stop = true; };
  }, [camId, micId]);
  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); cancelAnimationFrame(raf.current); }, []);
  // Switching to or from the Prompter view mounts a different preview: hand it the same camera.
  useEffect(() => {
    const v = live.current, st = stream.current;
    if (v && st && v.srcObject !== st) { v.srcObject = st; v.play().catch(() => {}); }
  }, [pv]);

  // Scroll the script while recording, at his speaking speed.
  useEffect(() => {
    if (mode !== "recording") return;
    let last = performance.now();
    const step = (now: number) => {
      const el = box.current;
      if (el && !paused) {
        const total = el.scrollHeight - el.clientHeight;
        const seconds = (words / wpm) * 60;
        pos.current = Math.min(total, pos.current + (total / Math.max(5, seconds)) * ((now - last) / 1000));
        el.scrollTop = pos.current;
      }
      last = now;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => { cancelAnimationFrame(raf.current); clearInterval(t); };
  }, [mode, paused, wpm, words]);

  const stopRec = useCallback(() => { if (rec.current?.state === "recording") rec.current.stop(); }, []);

  function begin() {
    const st = stream.current;
    if (!st) return;
    const type = MP4.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
    if (!type) { setErr("This browser can't record MP4. Use the latest Chrome or Safari."); return; }
    pos.current = 0; if (box.current) box.current.scrollTop = 0;
    setErr(""); setNote(""); setPaused(false); setSecs(0); setCount(3); setMode("countdown");
    let n = 3;
    const t = setInterval(() => {
      n -= 1; setCount(n);
      if (n > 0) return;
      clearInterval(t);
      // Vertical: draw the middle 9:16 of the camera onto a canvas and record that.
      let src: MediaStream = st;
      const v = live.current!;
      if (vertical && v.videoWidth > v.videoHeight) {
        const c = document.createElement("canvas");
        const h = Math.min(1920, v.videoHeight), w = Math.round((h * 9) / 16);
        c.width = w; c.height = h; canvas.current = c;
        const g = c.getContext("2d")!;
        const sx = (v.videoWidth - (v.videoHeight * 9) / 16) / 2;
        const draw = () => { g.drawImage(v, sx, 0, (v.videoHeight * 9) / 16, v.videoHeight, 0, 0, w, h); raf2 = requestAnimationFrame(draw); };
        let raf2 = requestAnimationFrame(draw);
        src = new MediaStream([...c.captureStream(30).getVideoTracks(), ...st.getAudioTracks()]);
        src.addEventListener("inactive", () => cancelAnimationFrame(raf2));
        (src as MediaStream & { _stopDraw?: () => void })._stopDraw = () => cancelAnimationFrame(raf2);
      }
      const r = new MediaRecorder(src, { mimeType: type, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        (src as MediaStream & { _stopDraw?: () => void })._stopDraw?.();
        if (src !== st) src.getVideoTracks().forEach((tr) => tr.stop());
        const b = new Blob(chunks.current, { type: "video/mp4" });
        setBlob(b); setUrl(URL.createObjectURL(b)); setMode("review");
      };
      rec.current = r; r.start(1000); setMode("recording");
    }, 1000);
  }

  function redo() { if (url) URL.revokeObjectURL(url); setBlob(null); setUrl(null); setMode("setup"); }
  function go(next: string) { if (url) URL.revokeObjectURL(url); setBlob(null); setUrl(null); setCode(next); setMode("setup"); pos.current = 0; if (box.current) box.current.scrollTop = 0; window.history.replaceState(null, "", `?set=${set}&code=${next}`); }

  async function upload() {
    if (!blob) return;
    setMode("uploading"); setErr("");
    const path = `${code}.mp4`;
    const sb = createClient();
    await fetch("/api/auth/keepalive", { cache: "no-store" }).catch(() => {});
    const { error } = await sb.storage.from("program-videos").upload(path, blob, { upsert: true, contentType: "video/mp4", cacheControl: "31536000" });
    if (error) { setErr(`Upload failed: ${error.message}`); setMode("review"); return; }
    const r = await registerVideo({ code, path, portrait: vertical, seconds: secs || null, bytes: blob.size });
    if (r?.error) { setErr(r.error); setMode("review"); return; }
    setDone((d) => new Set(d).add(code));
    const next = codes.slice(at + 1).find((c) => !done.has(c));
    setNote(`✓ ${code} uploaded.`);
    if (next) go(next); else redo();
  }

  // Keys: space starts / pauses, Enter stops, ↑ ↓ nudge the script.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, select, textarea")) return;
      if (e.code === "Space") { e.preventDefault(); if (mode === "setup") begin(); else if (mode === "recording") setPaused((p) => !p); }
      if (e.code === "Enter" && mode === "recording") { e.preventDefault(); stopRec(); }
      if ((e.code === "ArrowDown" || e.code === "ArrowUp") && box.current) { e.preventDefault(); pos.current = Math.max(0, pos.current + (e.code === "ArrowDown" ? 60 : -60)); box.current.scrollTop = pos.current; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const busy = mode === "countdown" || mode === "recording";
  const reviewing = mode === "review" || mode === "uploading";
  const fontSize = pv ? pvSize : size;
  const sizeKey = pv ? "dwtp-tp-pvsize" : "dwtp-tp-size";
  const setFont = (v: number) => { if (pv) setPvSize(v); else setSize(v); keep(sizeKey, String(v)); };
  const togglePv = (v: boolean) => { setPv(v); keep("dwtp-tp-prompter", v ? "1" : "0"); };
  const btn = "rounded-lg border border-white/20 px-2.5 py-1 disabled:opacity-30";

  const picker = (
    <>
      {sets.map((x) => <Link key={x.key} href={`/coach/videos/record?set=${x.key}`} aria-disabled={busy} className={`${btn} ${x.key === set ? "border-[#f5a623] text-[#f5a623]" : "text-white/70"} ${busy ? "pointer-events-none opacity-30" : ""}`}>{x.label}</Link>)}
      <button type="button" disabled={busy || at <= 0} onClick={() => go(codes[at - 1])} className={btn}>‹</button>
      <select value={code} disabled={busy} onChange={(e) => go(e.target.value)} className="max-w-[46vw] rounded-lg border border-white/20 bg-black px-2 py-1">
        {codes.map((c) => <option key={c} value={c}>{done.has(c) ? "✓ " : ""}{c} · {scripts[c].circle} · {scripts[c].medal}</option>)}
      </select>
      <button type="button" disabled={busy || at >= codes.length - 1} onClick={() => go(codes[at + 1])} className={btn}>›</button>
      <span className="text-white/50">{done.size} of {codes.length} uploaded</span>
    </>
  );
  const sliders = (
    <span className="flex items-center gap-3 text-white/70">
      <label className="flex items-center gap-1.5">Speed <input type="range" min={90} max={220} step={5} value={wpm} onChange={(e) => { setWpm(+e.target.value); keep("dwtp-tp-wpm", e.target.value); }} /> {wpm}</label>
      <label className="flex items-center gap-1.5">Text <input type="range" min={24} max={96} step={2} value={fontSize} onChange={(e) => setFont(+e.target.value)} /></label>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={pv} disabled={busy} onChange={(e) => togglePv(e.target.checked)} /> Prompter view</label>
      {pv && <label className="flex items-center gap-1.5"><input type="checkbox" checked={mirror} onChange={(e) => { setMirror(e.target.checked); keep("dwtp-tp-mirror", e.target.checked ? "1" : "0"); }} /> Mirror</label>}
    </span>
  );
  const scriptBox = (cls: string, pClass: string) => (
    <div ref={box} className={`${cls} overflow-hidden`} style={{ maskImage: "linear-gradient(transparent, black 10%, black 82%, transparent)" }}>
      <p className={`${pClass} whitespace-pre-line font-semibold leading-[1.35]`} style={{ fontSize, transform: pv && mirror ? "scaleX(-1)" : undefined }}>{text}</p>
    </div>
  );
  const devices = <>
    {cams.length > 1 && <select value={camId} onChange={(e) => { setCamId(e.target.value); keep("dwtp-cam", e.target.value); }} className="max-w-48 rounded-lg border border-white/20 bg-black px-2 py-1.5">{cams.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>)}</select>}
    {mics.length > 1 && <select value={micId} onChange={(e) => { setMicId(e.target.value); keep("dwtp-mic", e.target.value); }} className="max-w-48 rounded-lg border border-white/20 bg-black px-2 py-1.5">{mics.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>)}</select>}
  </>;
  const actions = <>
    {mode === "setup" && <>
      <label className="flex items-center gap-1.5 text-white/70"><input type="checkbox" checked={vertical} onChange={(e) => { setVertical(e.target.checked); keep(vKey, e.target.checked ? "1" : "0"); }} /> Vertical (9:16){pv ? "" : ", like your phone videos"}</label>
      {devices}
      <button type="button" onClick={begin} className={`${pv ? "min-h-10 px-5" : "min-h-12 px-7"} rounded-full bg-[#ef4444] text-[16px] font-bold`}>● Record {code}</button>
      {!pv && <span className="text-[12px] text-white/50">Space = start / pause · Enter = stop · ↑ ↓ = move the script</span>}
    </>}
    {mode === "recording" && <>
      <button type="button" onClick={() => setPaused((p) => !p)} className={`${pv ? "min-h-10" : "min-h-12"} rounded-full border border-white/30 px-6`}>{paused ? "▶ Resume scroll" : "⏸ Pause scroll"}</button>
      <button type="button" onClick={stopRec} className={`${pv ? "min-h-10" : "min-h-12"} rounded-full bg-white px-7 font-bold text-black`}>■ Stop</button>
    </>}
    {reviewing && <>
      <button type="button" disabled={mode === "uploading"} onClick={upload} className={`${pv ? "min-h-10" : "min-h-12"} rounded-full bg-[#f5a623] px-7 text-[16px] font-bold text-black disabled:opacity-60`}>{mode === "uploading" ? "Uploading…" : `⬆ Upload as ${code}${done.has(code) ? " (replaces it)" : ""}`}</button>
      <button type="button" disabled={mode === "uploading"} onClick={redo} className={`${pv ? "min-h-10" : "min-h-12"} rounded-full border border-white/30 px-6`}>↺ Redo</button>
      {url && <a href={url} download={`${code}.mp4`} className={`${pv ? "min-h-10" : "min-h-12"} content-center rounded-full border border-white/30 px-6`}>⬇ Download</a>}
    </>}
    {note && <span className="text-[#7ddc8f]">{note}</span>}
    {err && <span className="text-[#ff9a9a]">{err}</span>}
  </>;
  const recBadge = busy && <span className="absolute right-4 top-2 z-10 rounded-full bg-[#ef4444] px-3 py-1 text-[13px] font-bold">● {mode === "countdown" ? "…" : mmss(secs)}{paused ? " · paused" : ""}</span>;

  // Prompter view: the script fills the screen; the camera is a small framing preview in the corner.
  if (pv) return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black text-white">
      {!busy && <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-2 text-[12px]">
        <Link href="/coach/videos" className={`${btn} text-white/70`}>←</Link>
        {picker}
        <span className="ml-auto">{sliders}</span>
      </div>}
      <div className="relative min-h-0 flex-1">
        {recBadge}
        {reviewing && url
          ? <video src={url} controls autoPlay playsInline className="absolute inset-0 m-auto h-full max-h-full w-auto bg-black" />
          : scriptBox("absolute inset-0 px-[5vw]", "pb-[60vh] pt-[6vh] text-left")}
        {mode === "countdown" && <div className="absolute inset-0 grid place-items-center bg-black/60 text-[160px] font-bold">{count}</div>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 px-3 py-2 text-[13px]">
        {/* A small framing preview beside the buttons (kept running while recording, just hidden). */}
        <div className={`relative h-14 overflow-hidden rounded-md border border-white/20 bg-black ${busy || reviewing ? "absolute opacity-0" : ""}`} style={{ aspectRatio: "16 / 9" }}>
          <video ref={live} muted playsInline className="h-full w-full -scale-x-100 object-contain" />
          {vertical && <div className="pointer-events-none absolute inset-y-0 left-1/2 aspect-[9/16] h-full -translate-x-1/2 border border-dashed border-[#f5a623]/80" />}
        </div>
        {actions}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black text-white">
      {/* The script: top of the screen, right under the webcam. */}
      <div className="relative shrink-0 bg-black/90 px-6 pt-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
          <Link href="/coach/videos" className={`${btn} text-white/70`}>← Videos</Link>
          {picker}
          <span className="ml-auto">{sliders}</span>
        </div>
        {scriptBox("h-[34vh]", "mx-auto max-w-4xl pb-[30vh] pt-[2vh] text-center")}
        {recBadge}
      </div>

      {/* The camera (mirrored so it feels natural) with the vertical frame marked. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={live} muted playsInline className={`absolute inset-0 h-full w-full -scale-x-100 object-contain ${reviewing ? "invisible" : ""}`} />
        {vertical && !reviewing && (
          <div className="pointer-events-none absolute inset-y-0 left-1/2 aspect-[9/16] h-full -translate-x-1/2 rounded-xl border-2 border-dashed border-[#f5a623]/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        )}
        {mode === "countdown" && <div className="absolute inset-0 grid place-items-center text-[160px] font-bold text-white/90">{count}</div>}
        {reviewing && url && (
          <video src={url} controls autoPlay playsInline className="absolute inset-0 m-auto h-full max-h-full w-auto bg-black" />
        )}
      </div>

      {/* Controls */}
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 bg-black/90 px-4 py-3 text-[14px]">{actions}</div>
    </div>
  );
}
