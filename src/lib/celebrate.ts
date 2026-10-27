"use client";
/** Ka-ching and confetti when she earns Capacity Points. Sound can be turned off under Me; confetti respects reduced motion. */
const SOUND_KEY = "dwtp-sound";
let audio: HTMLAudioElement | null = null;

export function soundOn() {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
}
export function setSound(on: boolean) {
  try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch { /* private mode */ }
}

export function kaChing() {
  if (!soundOn()) return;
  try {
    audio ??= new Audio("/sounds/ka-ching.mp3");
    audio.currentTime = 0;
    audio.volume = 0.8;
    void audio.play().catch(() => { /* the browser blocked sound until she taps something */ });
  } catch { /* no audio */ }
}

/** A short burst of gold confetti from an element (or the middle of the screen). */
export function confetti(from?: Element | null) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = from?.getBoundingClientRect();
  const ox = r ? r.left + r.width / 2 : window.innerWidth / 2, oy = r ? r.top + r.height / 2 : window.innerHeight / 3;
  const c = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  c.width = window.innerWidth * dpr; c.height = window.innerHeight * dpr;
  Object.assign(c.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "60" });
  document.body.appendChild(c);
  const ctx = c.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const colors = ["#f5a623", "#ffcc75", "#fff3d6", "#22c55e", "#818cf8"];
  const bits = Array.from({ length: 70 }, () => {
    const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 7;
    return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, s: 4 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0], round: Math.random() < 0.35 };
  });
  const t0 = performance.now();
  const frame = (t: number) => {
    const k = (t - t0) / 1400;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const b of bits) {
      b.vy += 0.28; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.rot += b.vr;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = b.c;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      if (b.round) { ctx.beginPath(); ctx.arc(0, 0, b.s / 2, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
      ctx.restore();
    }
    if (k < 1) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

export function celebrate(from?: Element | null) { kaChing(); confetti(from); }

/** She already celebrated these points where she earned them, so the Today counter doesn't celebrate them twice. */
export function markSeen(points: number) {
  try {
    const v = localStorage.getItem("dwtp-cps-seen");
    if (v !== null && Number.isFinite(Number(v))) localStorage.setItem("dwtp-cps-seen", String(Number(v) + points));
  } catch { /* private mode */ }
}
