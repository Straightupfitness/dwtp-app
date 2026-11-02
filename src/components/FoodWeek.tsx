"use client";
import { useEffect, useRef, useState } from "react";
import type { FoodDay, FoodWeekData } from "@/lib/food-week";

const display = "font-[family-name:var(--font-display)] uppercase";
const wd = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
const md = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const long = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

/** On target = within 100 kcal; amber when she's off, grey when there's no target yet. */
function kcalTone(kcal: number, target: number | null) {
  if (!target) return "text-text";
  return Math.abs(kcal - target) <= 100 ? "text-[#7ee2a8]" : "text-accent";
}
function Bar({ value, goal, color }: { value: number; goal: number; color: string }) {
  return <span className="block h-1.5 overflow-hidden rounded-full bg-[#262626]"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (value / goal) * 100)}%`, background: color }} /></span>;
}

/**
 * Her last 7 days of food on one screen (November 1). Tap a day for every meal, food and photo in a pop-up,
 * then swipe (or use the arrows, or ← → on the keyboard) to go from day to day.
 */
export default function FoodWeek({ data, title = "Food · last 7 days" }: { data: FoodWeekData; title?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const { days, targets: t } = data;
  const logged = days.filter((d) => d.meals.length);
  const avg = (f: (d: FoodDay) => number) => (logged.length ? Math.round(logged.reduce((a, d) => a + f(d), 0) / logged.length) : null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">{title}</h2>
        <p className="text-[12px] text-dim">{logged.length}/7 days logged{avg((d) => d.kcal) !== null && <> · avg <b className="text-text">{avg((d) => d.kcal)}</b> kcal · <b className="text-text">{avg((d) => d.protein)}</b> g protein · <b className="text-text">{avg((d) => d.fiber)}</b> g fiber</>}{t.kcal ? ` · target ${t.kcal}` : ""}</p>
      </div>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-7 md:overflow-visible md:px-0">
        {days.map((d, i) => (
          <button key={d.date} type="button" onClick={() => setOpen(i)}
            className={`flex w-[170px] shrink-0 snap-start flex-col gap-2 rounded-[14px] border bg-card p-2.5 text-left transition hover:border-accent md:w-auto ${d.date === data.today ? "border-[#3a3020]" : "border-border"}`}>
            <span className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold">{d.date === data.today ? "Today" : wd(d.date)}</span>
              <span className="text-[11px] text-dim">{md(d.date)}</span>
            </span>
            {d.meals.length ? <>
              <span className={`${display} text-[24px] leading-none ${kcalTone(d.kcal, t.kcal)}`}>{d.kcal}<span className="ml-1 text-[11px] normal-case text-dim">kcal</span></span>
              <span className="space-y-1 text-[11px] text-[#a8a8a8]">
                <span className="flex justify-between"><span>Protein</span><span>{d.protein} g</span></span><Bar value={d.protein} goal={t.protein} color="#f97316" />
                <span className="flex justify-between"><span>Fiber</span><span>{d.fiber} g</span></span><Bar value={d.fiber} goal={t.fiber} color="#22c55e" />
                <span className="flex justify-between"><span>Potassium</span><span>{(d.potassium / 1000).toFixed(1)}k</span></span><Bar value={d.potassium} goal={t.potassium} color="#c084fc" />
              </span>
              <span className="space-y-1 border-t border-border pt-1.5">
                {d.meals.map((m) => (
                  <span key={m.id} className="block text-[11px] leading-snug">
                    <span className="text-dim">{m.slot} · </span>{m.kcal} kcal · {m.protein} g P
                    <span className="block truncate text-[#8a8a8a]">{m.items.map((x) => x.name).join(", ") || m.description}</span>
                  </span>
                ))}
              </span>
              {d.meals.some((m) => m.photo) && (
                <span className="flex gap-1">
                  {d.meals.filter((m) => m.photo).slice(0, 4).map((m) => (
                    // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
                    <img key={m.id} src={m.photo!} alt="" className="size-8 rounded-md object-cover" />
                  ))}
                </span>
              )}
            </> : <span className="py-6 text-center text-[12px] text-dim">Nothing logged</span>}
          </button>
        ))}
      </div>
      {open !== null && <DayPopup data={data} index={open} setIndex={setOpen} />}
    </div>
  );
}

function DayPopup({ data, index, setIndex }: { data: FoodWeekData; index: number; setIndex: (i: number | null) => void }) {
  const d = data.days[index];
  const t = data.targets;
  const touch = useRef<number | null>(null);
  const go = (n: number) => { if (n >= 0 && n < data.days.length) setIndex(n); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "ArrowRight") go(index + 1);
    };
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  });
  const tiles: [string, string][] = [
    [String(d.kcal), t.kcal ? `of ${t.kcal} kcal` : "kcal"],
    [`${d.protein} g`, `of ${t.protein} g protein`],
    [`${d.fiber} g`, `of ${t.fiber} g fiber`],
    [`${(d.potassium / 1000).toFixed(1)}k`, `of ${(t.potassium / 1000).toFixed(1)}k mg K`],
  ];
  const arrow = "grid size-11 shrink-0 place-items-center rounded-full border border-border text-xl disabled:opacity-25";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 md:items-center md:p-6" onClick={() => setIndex(null)} role="dialog" aria-modal="true" aria-label={`Food on ${long(d.date)}`}>
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[22px] border border-border bg-bg md:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1)); }}>
        <div className="flex items-center gap-2 border-b border-border p-3">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Day before" className={arrow}>‹</button>
          <div className="min-w-0 flex-1 text-center">
            <p className={`${display} text-[20px] leading-tight`}>{d.date === data.today ? "Today" : long(d.date)}</p>
            <p className="text-[11px] text-dim">{d.meals.length} meal{d.meals.length === 1 ? "" : "s"} · day {index + 1} of {data.days.length} · swipe or use ← →</p>
          </div>
          <button type="button" onClick={() => go(index + 1)} disabled={index === data.days.length - 1} aria-label="Next day" className={arrow}>›</button>
          <button type="button" onClick={() => setIndex(null)} aria-label="Close" className="grid size-11 shrink-0 place-items-center text-dim">✕</button>
        </div>
        <div className="space-y-3 overflow-y-auto p-3">
          <div className="grid grid-cols-4 gap-2 rounded-[16px] border border-border bg-card p-3 text-center">
            {tiles.map(([v, l], i) => (
              <div key={l}><p className={`${display} text-xl leading-none ${i === 0 ? kcalTone(d.kcal, t.kcal) : ""}`}>{v}</p><p className="mt-1 text-[11px] text-dim">{l}</p></div>
            ))}
          </div>
          {d.meals.map((m) => (
            <article key={m.id} className="space-y-2 rounded-[16px] border border-border bg-card p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-accent">{m.slot} · {m.time}{m.source ? ` · ${m.source}` : ""}</p>
                <p className="shrink-0 text-[13px] font-semibold">{m.kcal} kcal · {m.protein} g P · {m.fiber} g F</p>
              </div>
              <div className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL */}
                {m.photo && <a href={m.photo} target="_blank" rel="noreferrer" className="shrink-0"><img src={m.photo} alt="" className="size-28 rounded-xl object-cover md:size-36" /></a>}
                <div className="min-w-0 flex-1">
                  {m.description && <p className="text-[13px] italic text-[#a8a8a8]">&ldquo;{m.description}&rdquo;</p>}
                  <ul className="divide-y divide-border text-[14px]">
                    {m.items.map((it, i) => (
                      <li key={i} className="flex justify-between gap-3 py-1.5"><span>{it.name} <span className="text-dim">· {it.amount}</span></span><span className="shrink-0 text-dim">{Math.round(it.calories)} kcal · {Math.round(it.protein_g)} g</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
          {!d.meals.length && <p className="rounded-2xl border border-dashed border-[#2f2f2f] p-8 text-center text-dim">Nothing logged this day.</p>}
        </div>
      </div>
    </div>
  );
}
