"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_SECONDS = 480;
const MAX_BYTES = 50 * 1024 * 1024;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
type Kind = "me" | "screen";
type Mode = "idle" | "choose" | "ready" | "recording" | "review" | "uploading" | "done";

/** What the page he's on can do with the video: a check-in reply, her chat, or just a download. */
function pageContext(viewing: { id: string; first: string } | null) {
  const ci = document.querySelector<HTMLElement>("[data-record-checkin]");
  const cl = document.querySelector<HTMLElement>("[data-record-client]");
  const client = ci?.dataset.recordClient ? { id: ci.dataset.recordClient, first: ci.dataset.recordFirst || "her" }
    : cl?.dataset.recordClient ? { id: cl.dataset.recordClient, first: cl.dataset.recordFirst || "her" } : viewing;
  return { checkin: !!ci, client };
}

/**
 * November 20 (Michael): one "🎥 Record myself" button on every page of his app. He picks:
 *  - Only me: his camera and microphone, with a small preview floating in the corner while he scrolls.
 *  - Screen + me: this tab, his microphone, and his camera in a round bubble in the corner (it ends up in the video).
 * The recording keeps going while he moves between pages. Then: use it as her check-in reply (on a check-in), send it
 * to her chat (on her client page, a check-in, or while he's looking at her app), or download it.
 */
export default function RecordMyself({ viewing }: { viewing: { id: string; first: string } | null }) {
  const path = usePathname();
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest("input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, [contenteditable=true], select");
    const on = (e: FocusEvent) => setTyping(isField(e.target));
    const off = () => setTimeout(() => setTyping(isField(document.activeElement)), 0);
    document.addEventListener("focusin", on); document.addEventListener("focusout", off);
    return () => { document.removeEventListener("focusin", on); document.removeEventListener("focusout", off); };
  }, []);
  const [mode, setMode] = useState<Mode>("idle");
  const [kind, setKind] = useState<Kind>("me");
  const [screenOk, setScreenOk] = useState(false);
  const [secs, setSecs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [big, setBig] = useState(false);
  const [left, setLeft] = useState(false);
  // November 20 (Michael): the camera bubble in "Screen + me" is 35% bigger (176 → 238 px) and he drags it anywhere.
  // Its spot is remembered for next time. null = the default bottom-right corner.
  const BUBBLE = 238;
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const clamp = (x: number, y: number) => ({ x: Math.min(Math.max(8, x), window.innerWidth - BUBBLE - 8), y: Math.min(Math.max(8, y), window.innerHeight - BUBBLE - 8) });
  const [ctx, setCtx] = useState<ReturnType<typeof pageContext>>({ checkin: false, client: null });
  const [note, setNote] = useState("");
  const live = useRef<HTMLVideoElement>(null);
  const streams = useRef<MediaStream[]>([]);
  const camStream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- checking what this browser can do, once
  useEffect(() => { setScreenOk(!!navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices && !/iPhone|iPad|Android/i.test(navigator.userAgent)); }, []);
  useEffect(() => () => streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop())), []);
  // November 20 (Michael): a recording he hasn't used, sent or downloaded yet only lives in this tab. Warn before a
  // refresh or closing the tab would throw it away. (Moving between pages inside the app keeps it.)
  useEffect(() => {
    if (!["recording", "review", "uploading"].includes(mode)) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [mode]);
  useEffect(() => {
    if (mode !== "recording") return;
    const t = setInterval(() => setSecs((s) => { if (s + 1 >= MAX_SECONDS) rec.current?.stop(); return s + 1; }), 1000);
    return () => clearInterval(t);
  }, [mode]);
  useEffect(() => {
    const v = live.current, s = camStream.current;
    if ((mode === "ready" || mode === "recording") && v && s && v.srcObject !== s) { v.srcObject = s; v.play().catch(() => {}); }
  }, [mode, kind]);

  const saved = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
  const stopAll = () => { streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop())); streams.current = []; camStream.current = null; };

  async function camera(small: boolean) {
    const cam = saved("dwtp-cam"), mic = saved("dwtp-mic");
    const size = small ? { width: { ideal: 480 }, height: { ideal: 480 } } : { width: { ideal: 1280 }, height: { ideal: 720 } };
    try { return await navigator.mediaDevices.getUserMedia({ video: { ...size, ...(cam ? { deviceId: { exact: cam } } : { facingMode: "user" }) }, audio: mic ? { deviceId: { exact: mic } } : true }); }
    catch { return await navigator.mediaDevices.getUserMedia({ video: { ...size, facingMode: "user" }, audio: true }); }
  }

  function record(stream: MediaStream, bits: number) {
    const type = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: bits, audioBitsPerSecond: 64_000 });
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      stopAll();
      const b = new Blob(chunks.current, { type: r.mimeType || "video/webm" });
      const c = pageContext(viewing);
      setCtx(c); setNote(c.client ? `Hi ${c.client.first}, ` : "");
      setBlob(b); setUrl(URL.createObjectURL(b)); setMode("review");
    };
    rec.current = r; setSecs(0); r.start(1000); setMode("recording");
  }

  async function pick(k: Kind) {
    setErr(""); setDone(""); setKind(k);
    try {
      if (k === "me") {
        const s = await camera(false);
        streams.current = [s]; camStream.current = s; setMode("ready");
      } else {
        const screen = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 24, width: { ideal: 1600 }, height: { ideal: 1000 } }, audio: false,
          ...({ preferCurrentTab: true, selfBrowserSurface: "include" } as object),
        } as DisplayMediaStreamOptions);
        streams.current = [screen];
        const me = await camera(true);
        streams.current.push(me); camStream.current = me;
        const mixed = new MediaStream([...screen.getVideoTracks(), ...me.getAudioTracks()]);
        screen.getVideoTracks()[0].addEventListener("ended", () => { if (rec.current?.state === "recording") rec.current.stop(); });
        try { const saved = JSON.parse(localStorage.getItem("dwtp-bubble") ?? "null"); setSpot(saved ? clamp(saved.x, saved.y) : null); } catch { setSpot(null); }
        record(mixed, 900_000);
      }
    } catch {
      stopAll(); setMode("idle");
      setErr(k === "me" ? "I couldn't open your camera. Allow camera and microphone access, then try again."
        : "Recording didn't start. Allow screen, camera and microphone access, and pick this tab when the browser asks.");
    }
  }

  function reset() { if (url) URL.revokeObjectURL(url); setBlob(null); setUrl(null); setErr(""); setMode("idle"); }

  async function upload(bucket: string, path: string) {
    if (!blob) return null;
    if (blob.size > MAX_BYTES) { setErr("That video is over 50 MB. Record a shorter one."); return null; }
    setMode("uploading"); setErr("");
    const sb = createClient();
    for (let i = 0; i < 2; i++) {
      await fetch("/api/auth/keepalive", { cache: "no-store" }).catch(() => {});
      const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType: blob.type || "video/webm", upsert: true });
      if (!error) return path;
      if (i) { setErr(`Upload failed: ${error.message}`); setMode("review"); }
    }
    return null;
  }
  const ext = () => (blob?.type.includes("mp4") ? "mp4" : "webm");

  async function useAsReply() {
    if (!ctx.client) return;
    const p = await upload("checkin-videos", `${ctx.client.id}/replies/${crypto.randomUUID()}.${ext()}`);
    if (!p) return;
    window.dispatchEvent(new CustomEvent("dwtp-reply-video", { detail: p }));
    setDone("✓ Added to your check-in reply. Tap Send to her when you're ready."); reset(); setMode("done");
  }
  async function sendToChat() {
    if (!ctx.client) return;
    const p = await upload("media", `chat/${ctx.client.id}/${crypto.randomUUID()}.${ext()}`);
    if (!p) return;
    const r = await fetch("/api/coach/video-reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: ctx.client.id, path: p, note: ctx.checkin ? "" : note }) })
      .then((x) => x.json()).catch(() => ({ error: "Sending failed. Check your connection and try again." }));
    if (r?.error) { setErr(r.error); setMode("review"); return; }
    setDone(`✓ Sent to ${ctx.client.first}'s chat.`); reset(); setMode("done");
  }
  function download() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = `video-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext()}`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  const btn = "min-h-10 rounded-lg px-3.5 text-[14px] font-semibold";
  // November 26 (Michael): when it's just sitting there, it's a small round camera button, and it steps aside on chat
  // screens and while he's typing, so it never covers a message box or a button.
  const hide = mode === "idle" && (typing || /^\/(chat|coach\/inbox|coach\/text)/.test(path ?? ""));
  const corner = left ? "left-4" : "right-4";
  return (
    <div className="print:hidden">
      {(mode === "idle" || mode === "done" || mode === "choose") && !hide && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-40 flex flex-col items-end gap-2 md:bottom-6">
          {mode === "choose" && (
            <div className="w-64 space-y-1 rounded-2xl border border-border bg-[#121212] p-2 shadow-2xl" role="menu">
              <button type="button" role="menuitem" onClick={() => pick("me")} className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left hover:bg-white/5">
                <span className="text-xl">🙂</span><span><b className="block text-[14px]">Only me</b><span className="text-[12px] text-dim">Your camera, while you scroll</span></span>
              </button>
              {screenOk && (
                <button type="button" role="menuitem" onClick={() => pick("screen")} className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left hover:bg-white/5">
                  <span className="text-xl">🖥️</span><span><b className="block text-[14px]">Screen + me</b><span className="text-[12px] text-dim">This page, with you in a bubble</span></span>
                </button>
              )}
            </div>
          )}
          {done && mode === "done" && <p className="max-w-xs rounded-lg bg-[#132a1b] p-2 text-[13px] text-[#7ddc8f]">{done}</p>}
          {err && <p className="max-w-xs rounded-lg bg-[#2a1515] p-2 text-[13px] text-[#ff9a9a]">{err}</p>}
          <button type="button" onClick={() => { setErr(""); setDone(""); setMode(mode === "choose" ? "idle" : "choose"); }} aria-expanded={mode === "choose"}
            title="Record myself" aria-label={mode === "choose" ? "Close" : "Record myself"}
            className={`rounded-full shadow-2xl ${mode === "choose" ? "min-h-11 bg-accent px-4 text-[14px] font-semibold text-black" : "grid size-11 place-items-center border border-accent/60 bg-black/80 text-[18px] opacity-80 hover:opacity-100"}`}>
            {mode === "choose" ? "✕ Close" : "🎥"}
          </button>
        </div>
      )}

      {/* Only me: the camera preview floats in the corner. */}
      {kind === "me" && (mode === "ready" || mode === "recording") && (
        <div className={`fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] ${corner} z-50 overflow-hidden rounded-2xl border-2 bg-black shadow-2xl md:bottom-6 ${mode === "recording" ? "border-[#ef4444]" : "border-accent"} ${big ? "w-[420px]" : "w-[260px]"}`}>
          <video ref={live} muted playsInline className="aspect-video w-full -scale-x-100 object-cover" />
          <div className="flex items-center gap-1.5 bg-black/85 p-1.5">
            {mode === "ready" ? <>
              <button type="button" onClick={() => camStream.current && record(camStream.current, 600_000)} className={`${btn} flex-1 bg-[#ef4444] text-white`}>● Start</button>
              <button type="button" onClick={() => { stopAll(); setMode("idle"); }} className={`${btn} text-dim`}>Cancel</button>
            </> : <>
              <span className="flex items-center gap-1.5 px-1 text-[13px] text-white"><span className="size-2.5 animate-pulse rounded-full bg-[#ef4444]" />{mmss(secs)}</span>
              <button type="button" onClick={() => rec.current?.stop()} className={`${btn} flex-1 bg-white text-black`}>■ Stop</button>
            </>}
            <button type="button" onClick={() => setBig((x) => !x)} aria-label={big ? "Smaller" : "Bigger"} className="min-h-10 px-2 text-white">{big ? "▫" : "□"}</button>
            <button type="button" onClick={() => setLeft((x) => !x)} aria-label="Move to the other corner" className="min-h-10 px-2 text-white">⇄</button>
          </div>
        </div>
      )}

      {/* Screen + me: a small bar at the top and his round camera bubble (both end up in the video). Tap the bubble to move it. */}
      {kind === "screen" && mode === "recording" && <>
        <div className="fixed left-1/2 top-3 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/85 px-4 py-2 text-[13px] text-white shadow-lg">
          <span className="font-semibold text-[#ff6b6b]">● {mmss(secs)}</span><span className="text-white/60">max {mmss(MAX_SECONDS)}</span>
          <button type="button" onClick={() => rec.current?.stop()} className="rounded-full bg-[#b3261e] px-3 py-1 font-semibold">Stop</button>
        </div>
        <video ref={live} muted playsInline title="Drag me anywhere"
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => { if (drag.current) setSpot(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy)); }}
          onPointerUp={() => { drag.current = null; try { if (spot) localStorage.setItem("dwtp-bubble", JSON.stringify(spot)); } catch {} }}
          className={`fixed z-[70] cursor-grab touch-none select-none rounded-full border-4 border-accent bg-black object-cover shadow-2xl active:cursor-grabbing ${spot ? "" : "bottom-6 right-4"}`}
          style={{ width: BUBBLE, height: BUBBLE, transform: "scaleX(-1)", ...(spot ? { left: spot.x, top: spot.y } : {}) }} />
      </>}

      {(mode === "review" || mode === "uploading") && url && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Your video">
          <div className="w-full max-w-2xl space-y-3 rounded-[20px] border border-border bg-[#121212] p-4">
            <p className="font-[family-name:var(--font-display)] text-xl uppercase">Your video · {mmss(secs)}</p>
            <video src={url} controls playsInline className="max-h-[55dvh] w-full rounded-xl bg-black" />
            {ctx.client && !ctx.checkin && (
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="A line of text with your video"
                className="w-full rounded-xl border border-border bg-card p-3 text-[15px] outline-none focus:border-accent" />
            )}
            {err && <p className="text-sm text-[var(--red)]">{err}</p>}
            <div className="flex flex-wrap gap-2">
              {ctx.checkin && ctx.client && <button type="button" disabled={mode === "uploading"} onClick={useAsReply} className={`${btn} flex-[2] bg-accent text-black disabled:opacity-50`}>{mode === "uploading" ? "Uploading…" : "Use as her check-in reply"}</button>}
              {ctx.client && !ctx.checkin && <button type="button" disabled={mode === "uploading"} onClick={sendToChat} className={`${btn} flex-[2] bg-accent text-black disabled:opacity-50`}>{mode === "uploading" ? "Sending…" : `Send to ${ctx.client.first}'s chat`}</button>}
              <button type="button" disabled={mode === "uploading"} onClick={download} className={`${btn} flex-1 border border-border`}>⬇ Download</button>
              <button type="button" disabled={mode === "uploading"} onClick={reset} className={`${btn} flex-1 border border-border text-dim`}>Discard</button>
            </div>
            {ctx.checkin && ctx.client && <button type="button" disabled={mode === "uploading"} onClick={sendToChat} className="text-[12px] text-dim underline">or send it to {ctx.client.first}&apos;s chat instead</button>}
          </div>
        </div>
      )}
    </div>
  );
}
