"use client";
import { useRef, useState } from "react";

type Rec = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: (e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void;
  onend: () => void; onerror: (e: { error: string }) => void; start: () => void; stop: () => void;
};

/**
 * Speak instead of typing (the food logger and chat). The browser hands back the whole session's words on every
 * update, so we rebuild the text from them each time instead of adding them on: adding them on is what made a
 * dictated meal show up two or three times (October 29 feedback). Android also hands back every growing version of
 * the same sentence as its own result ("two", "two whole", "two whole eggs" …); mergeResults keeps only the
 * longest (October 30 feedback).
 */
export function useDictation(onText: (text: string) => void) {
  const rec = useRef<Rec | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const supported = () => {
    if (typeof window === "undefined") return false;
    const W = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return !!(W.SpeechRecognition ?? W.webkitSpeechRecognition);
  };
  function toggle(base: string) {
    setError("");
    if (listening) { rec.current?.stop(); return; }
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const R = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!R) { setError("Tap the microphone on your keyboard to speak instead."); return; }
    const r = new R();
    r.lang = "en-US"; r.interimResults = true; r.continuous = true;
    const lead = base.trim() ? base.trim() + " " : "";
    r.onresult = (e) => onText(lead + mergeResults(Array.from(e.results).map((x) => x[0].transcript)));
    r.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") setError("Couldn't hear that. Try again, or use your keyboard's microphone."); };
    r.onend = () => setListening(false);
    rec.current = r; setListening(true);
    try { r.start(); } catch { setListening(false); }
  }
  return { listening, toggle, error, supported };
}

/**
 * The words she said, once: when a result is a longer version of the one before (Android), it replaces it;
 * a shorter repeat is dropped; anything new is added on.
 */
export function mergeResults(results: string[]) {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const out: string[] = [];
  for (const raw of results) {
    const t = raw.trim();
    if (!t) continue;
    const last = out[out.length - 1];
    if (last !== undefined) {
      const a = norm(last), b = norm(t);
      if (b === a || a.startsWith(b)) continue;          // same words again, or a shorter repeat
      if (b.startsWith(a)) { out[out.length - 1] = t; continue; } // a longer version of the same sentence
    }
    out.push(t);
  }
  return out.join(" ");
}
