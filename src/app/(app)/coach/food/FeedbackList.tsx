"use client";
import Link from "next/link";
import { useState } from "react";
import { draftFeedback, markTexted, sendFeedbackInChat, skipFeedback, undoFeedback } from "./actions";

export type FeedbackRow = {
  id: string; name: string; phone: string | null;
  kcal: number; protein: number; kcalTarget: number | null; proteinTarget: number;
  meals: { slot: string; kcal: number; protein: number; foods: string }[];
  draft: string | null; sentText: string | null; sentVia: "chat" | "text" | "skipped" | null;
};
type State = { text: string; busy: "" | "draft" | "send"; error: string; sentVia: FeedbackRow["sentVia"] };

/** A phone number for an sms: link (10 digits → +1). */
function smsHref(phone: string, body: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  const num = /^\d{10}$/.test(digits) ? `+1${digits}` : digits;
  return `sms:${num}?&body=${encodeURIComponent(body)}`;
}

export default function FeedbackList({ day, rows }: { day: string; rows: FeedbackRow[] }) {
  const [state, setState] = useState<Record<string, State>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, { text: r.sentText ?? r.draft ?? "", busy: "", error: "", sentVia: r.sentVia }])));
  const [all, setAll] = useState(false);
  const set = (id: string, s: Partial<State>) => setState((cur) => ({ ...cur, [id]: { ...cur[id], ...s } }));

  const draft = async (id: string) => {
    set(id, { busy: "draft", error: "" });
    const r = await draftFeedback(id, day);
    set(id, r.error ? { busy: "", error: r.error } : { busy: "", text: r.text ?? "" });
  };
  const todo = rows.filter((r) => !state[r.id].sentVia && !state[r.id].text.trim());
  const draftAll = async () => {
    setAll(true);
    const queue = [...todo];
    await Promise.all(Array.from({ length: 3 }, async () => { for (let r = queue.shift(); r; r = queue.shift()) await draft(r.id); }));
    setAll(false);
  };
  const open = rows.filter((r) => !state[r.id].sentVia);
  const done = rows.filter((r) => state[r.id].sentVia);

  if (!rows.length) return <p className="rounded-2xl border border-dashed border-[#2f2f2f] p-8 text-center text-dim">Nobody logged food this day.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-dim"><b className="text-text">{open.length}</b> to send · {done.length} done</p>
        {todo.length > 0 && (
          <button type="button" onClick={draftAll} disabled={all} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-black disabled:opacity-50">
            {all ? `Drafting… ${rows.filter((r) => state[r.id].text.trim()).length}/${rows.length}` : `Draft all ${todo.length}`}
          </button>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {open.map((r) => <Card key={r.id} r={r} s={state[r.id]} day={day} set={(s) => set(r.id, s)} draft={() => draft(r.id)} />)}
      </div>
      {done.length > 0 && (
        <div className="space-y-1.5">
          <h2 className="text-sm uppercase tracking-widest text-dim">Done</h2>
          {done.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <span className="shrink-0 text-[#7ee2a8]">{state[r.id].sentVia === "skipped" ? "–" : "✓"}</span>
              <span className="min-w-0 flex-1"><b>{r.name}</b> <span className="text-dim">· {state[r.id].sentVia === "chat" ? "sent in app" : state[r.id].sentVia === "text" ? "texted" : "skipped"}</span>
                {state[r.id].sentVia !== "skipped" && <span className="block truncate text-[12px] text-dim">{state[r.id].text}</span>}</span>
              <button type="button" onClick={async () => { await undoFeedback(r.id, day); set(r.id, { sentVia: null }); }} className="shrink-0 text-xs text-dim underline">Undo</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ r, s, day, set, draft }: { r: FeedbackRow; s: State; day: string; set: (s: Partial<State>) => void; draft: () => void }) {
  const [copied, setCopied] = useState(false);
  const kcalTone = r.kcalTarget ? (Math.abs(r.kcal - r.kcalTarget) <= 150 ? "text-[#7ee2a8]" : "text-accent") : "text-text";
  const done = async (p: Promise<{ error?: string } | { ok: boolean } | undefined>, via: NonNullable<State["sentVia"]>) => {
    const res = await p;
    if (res && "error" in res && res.error) set({ busy: "", error: res.error }); else set({ busy: "", sentVia: via });
  };
  const btn = "min-h-10 rounded-lg px-3 text-[13px] font-semibold disabled:opacity-40";
  const has = !!s.text.trim();
  return (
    <article className="space-y-2.5 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Link href={`/coach/clients/${r.id}`} className="font-semibold hover:text-accent">{r.name}</Link>
        <p className="text-[13px]"><b className={kcalTone}>{r.kcal}</b><span className="text-dim">{r.kcalTarget ? `/${r.kcalTarget}` : ""} kcal · </span>
          <b className={r.protein >= r.proteinTarget * 0.9 ? "text-[#7ee2a8]" : "text-text"}>{r.protein}</b><span className="text-dim">/{r.proteinTarget} g P</span></p>
      </div>
      <ul className="space-y-0.5 text-[12px] leading-snug text-[#a8a8a8]">
        {r.meals.map((m, i) => <li key={i} className="truncate"><span className="text-dim">{m.slot} · {m.kcal} kcal · {m.protein} g ·</span> {m.foods}</li>)}
      </ul>
      {has || s.busy === "draft" ? (
        <textarea value={s.busy === "draft" && !has ? "Drafting…" : s.text} onChange={(e) => set({ text: e.target.value })} rows={5} aria-label={`Message to ${r.name}`}
          className="w-full rounded-xl border border-[#2a2a2a] bg-bg p-2.5 text-[14px] leading-snug outline-none focus:border-accent" />
      ) : null}
      {s.error && <p className="text-[12px] text-[var(--red)]">{s.error}</p>}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={draft} disabled={s.busy !== ""} className={`${btn} ${has ? "border border-[#2f2f2f]" : "bg-accent text-black"}`}>
          {s.busy === "draft" ? "Drafting…" : has ? "Redraft" : "Draft"}
        </button>
        {has && r.phone && (
          <a href={smsHref(r.phone, s.text)} onClick={() => { set({ busy: "send" }); done(markTexted(r.id, day, s.text), "text"); }} className={`${btn} grid place-items-center bg-accent text-black`}>Text her</a>
        )}
        {has && <button type="button" disabled={s.busy !== ""} onClick={() => { set({ busy: "send" }); done(sendFeedbackInChat(r.id, day, s.text), "chat"); }}
          className={`${btn} ${r.phone ? "border border-accent text-accent" : "bg-accent text-black"}`}>{s.busy === "send" ? "Sending…" : "Send in app"}</button>}
        {has && <button type="button" onClick={async () => { await navigator.clipboard.writeText(s.text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className={`${btn} border border-[#2f2f2f]`}>{copied ? "Copied ✓" : "Copy"}</button>}
        <button type="button" disabled={s.busy !== ""} onClick={() => done(skipFeedback(r.id, day), "skipped")} className={`${btn} ml-auto text-dim`}>Skip</button>
      </div>
      {has && !r.phone && <p className="text-[11px] text-dim">No phone number on file. Add it on her page to text her.</p>}
    </article>
  );
}
