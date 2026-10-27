"use client";
import { useEffect, useState } from "react";
import { kaChing, setSound, soundOn } from "@/lib/celebrate";

/** Ka-ching on or off, for this phone. */
export default function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => { setOn(soundOn()); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- read once from this phone
  return (
    <button type="button" onClick={() => { const next = !on; setSound(next); setOn(next); if (next) kaChing(); }}
      className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left">
      <span className="text-sm">Sounds: {on ? "on" : "off"}<span className="block text-xs text-dim">The ka-ching when you earn Capacity Points.</span></span>
      <span className="min-h-9 rounded-lg border border-[#2a2a2a] px-3 py-2 text-xs">{on ? "Turn off" : "Turn on"}</span>
    </button>
  );
}
