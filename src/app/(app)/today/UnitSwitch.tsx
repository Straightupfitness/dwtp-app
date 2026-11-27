"use client";
import { useState, useTransition } from "react";
import { setWeightUnit } from "./actions";

/** November 26 (Michael): pounds or kilograms, right on the weigh-in card. */
export default function UnitSwitch({ unit }: { unit: "lbs" | "kg" }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <div className="flex items-center justify-end gap-2 text-[12px] text-dim">
      {err && <span className="text-[#ff9a9a]">{err}</span>}
      <span>Weigh in</span>
      <span className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Weight unit">
        {(["lbs", "kg"] as const).map((u) => (
          <button key={u} type="button" disabled={pending || u === unit} aria-pressed={u === unit}
            onClick={() => start(async () => { const r = await setWeightUnit(u); setErr(r && "error" in r && r.error ? r.error : ""); })}
            className={`min-h-7 px-2.5 font-semibold ${u === unit ? "bg-accent text-black" : "text-[#cfcfcf]"}`}>{u}</button>
        ))}
      </span>
    </div>
  );
}
