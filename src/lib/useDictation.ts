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
 * dictated meal show up two or three times (October 29 feedback).
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
    r.onresult = (e) => {
      // Every result so far in this session, once each.
      const words = Array.from(e.results).map((x) => x[0].transcript.trim()).filter(Boolean);
      const dedup = words.filter((w, i) => w !== words[i - 1]);
      onText(lead + dedup.join(" "));
    };
    r.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") setError("Couldn't hear that. Try again, or use your keyboard's microphone."); };
    r.onend = () => setListening(false);
    rec.current = r; setListening(true);
    try { r.start(); } catch { setListening(false); }
  }
  return { listening, toggle, error, supported };
}
