"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setWorkoutDays } from "./actions";

const NAMES = ["S", "M", "T", "W", "T", "F", "S"], FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const list = (days: number[]) => (days.length ? ORDER.filter((d) => days.includes(d)).map((d) => FULL[d].slice(0, 3)).join(", ") : "none yet");

/**
 * Her workout days (November 7, rebuilt for iPhone): tap Change, pick the days, tap Save.
 * A plain button rather than <details>, which Safari didn't always open, and the picker scrolls into view above the tab bar.
 */
export default function WorkoutDays({ initial, perWeek = 0 }: { initial: number[]; perWeek?: number }) {
  const [saved, setSaved] = useState(initial);
  const [days, setDays] = useState(initial);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => { if (open) box.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [open]);

  const toggle = (d: number) => { setMsg(""); setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d])); };
  const short = perWeek > 0 && days.length < perWeek;
  const save = () => start(async () => {
    const r = await setWorkoutDays(days);
    if (r?.error) { setMsg(r.error); return; }
    setSaved(days); setOpen(false); setMsg("Saved ✓ Your calendar is updated."); router.refresh();
  });

  return (
    <div ref={box} className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={() => { setOpen(!open); setDays(saved); setMsg(""); }} aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between gap-2 px-3.5 text-left">
        <span className="text-[14px]">Your workout days: <b>{list(saved)}</b></span>
        <span className="shrink-0 text-[13px] font-semibold text-accent">{open ? "Close" : "Change"}</span>
      </button>
      {open && (
        <div className="space-y-3 px-3.5 pb-3.5">
          <p className="text-[13px] text-[#a8a8a8]">{perWeek > 0 ? `You have ${perWeek} workouts a week. Tap ${perWeek} days, then Save.` : "Tap the days you want to work out, then Save."}</p>
          <div className="flex justify-between gap-1">
            {ORDER.map((d) => (
              <button key={d} type="button" onClick={() => toggle(d)} aria-pressed={days.includes(d)} aria-label={FULL[d]}
                className={`grid size-11 place-items-center rounded-full border text-[14px] font-semibold ${days.includes(d) ? "border-accent bg-accent text-black" : "border-[#2a2a2a] text-dim"}`}>
                {NAMES[d]}
              </button>
            ))}
          </div>
          <p className={`text-[12px] ${short ? "text-accent" : "text-dim"}`}>
            {list(days)}{short ? ` · pick ${perWeek - days.length} more` : perWeek && days.length > perWeek ? " · extra days show cardio or catch-up" : ""}
          </p>
          <button type="button" onClick={save} disabled={pending || short || !days.length}
            className="grid min-h-12 w-full place-items-center rounded-xl bg-accent text-[15px] font-semibold text-black disabled:opacity-40">
            {pending ? "Saving…" : "Save my workout days"}
          </button>
        </div>
      )}
      {msg && !open && <p className="px-3.5 pb-3 text-[12px] text-[#7ee2a8]">{msg}</p>}
      {msg && open && <p className="px-3.5 pb-3 text-[12px] text-[var(--red)]">{msg}</p>}
    </div>
  );
}
