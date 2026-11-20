"use client";
import { useMemo, useState, useTransition } from "react";
import Section from "@/components/Section";
import { Grip, useDnd } from "@/components/useDnd";
import { deleteKpi, saveKpi, type KpiTable } from "./actions";
import { ActionPlan, Matrix, Outline, usePlan } from "./Planner";
import type { PlanItem } from "./items";

type Expense = { id: string; name: string; category: "business" | "personal"; amount: number; frequency: "weekly" | "biweekly" | "monthly" | "yearly"; canceling: boolean; notes: string | null; position: number; draw_day?: number | null };
type Slot = { id: string; name: string; rent: number; plan_2027: number | null; plan_note: string | null; position: number };
type Client = { id: string; slot_id: string | null; name: string; monthly: number; paid_amount: number | null; paid_weeks: number | null; expires_on: string | null; renewal_offer: number | null; notes: string | null; position: number; started_on?: string | null; created_at?: string };
type Payment = { id: string; client_id: string | null; name: string; amount: number; paid_on: string; notes: string | null };
export type Data = { expenses: Expense[]; slots: Slot[]; clients: Client[]; payments: Payment[]; leads: (string | null)[]; today: string; items: PlanItem[]; planReady: boolean };

const n = (x: unknown) => Number(x ?? 0) || 0;
const money = (x: number) => `${x < 0 ? "−" : ""}$${Math.abs(x).toLocaleString("en-US", { maximumFractionDigits: Math.abs(x) % 1 ? 2 : 0, minimumFractionDigits: Math.abs(x) % 1 ? 2 : 0 })}`;
const PER_MONTH = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, yearly: 1 / 12 } as const;
const perMonth = (e: Expense) => Math.round(n(e.amount) * PER_MONTH[e.frequency] * 100) / 100;
const dateNice = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const isOnline = (s: Slot | undefined) => !!s && /online/i.test(s.name);
const addDaysTo = (d: string, days: number) => new Date(Date.parse(d + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);
const monthsBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / (86_400_000 * 30.44));
/** When she signed up: the date he entered, or worked out from when it expires and how long she paid for. */
const startOf = (c: Client) => c.started_on ?? (c.expires_on && c.paid_weeks ? addDaysTo(c.expires_on, -7 * c.paid_weeks) : c.created_at?.slice(0, 10) ?? null);
const byDay = (a: Expense, b: Expense) => (a.draw_day ?? 99) - (b.draw_day ?? 99) || perMonth(b) - perMonth(a);
const ordinal = (x: number) => `${x}${x % 10 === 1 && x !== 11 ? "st" : x % 10 === 2 && x !== 12 ? "nd" : x % 10 === 3 && x !== 13 ? "rd" : "th"}`;

type Field = { k: string; label: string; kind: "text" | "num" | "date" | "area" | "bool" | "select"; options?: [string, string][]; wide?: boolean };
type Edit = { table: KpiTable; id: string | null; title: string; f: Record<string, unknown> };

/**
 * November 17 (Michael): his KPIs. November 19: rebuilt as big numbers that open when tapped: in-person income (time
 * slots, drag names between them), online income (every client by sign-up date), business and personal expenses (with
 * the day each comes out), net profit; then his action plan, Eisenhower matrix and outline. Tap any row to edit it.
 */
export default function KpiView({ d }: { d: Data }) {
  const [edit, setEdit] = useState<Edit | null>(null);
  const [err, setErr] = useState("");
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();
  const plan = usePlan(d.items);
  const [expSort, setExpSort] = useState<"cost" | "az" | "day">("cost");
  const planReady = d.planReady;

  // November 19: drag a client to another time slot. Shown right away; saved in the background.
  const [moved, setMoved] = useState<Record<string, string>>({});
  const clients = useMemo(() => d.clients.map((c) => (moved[c.id] ? { ...c, slot_id: moved[c.id] } : c)), [d.clients, moved]);
  const dnd = useDnd((id, target) => {
    if (target === "none") return;
    if (clients.find((c) => c.id === id)?.slot_id === target) return;
    setMoved((m) => ({ ...m, [id]: target }));
    start(async () => { const r = await saveKpi("kpi_clients", id, { slot_id: target }); if (r?.error) { setErr(r.error); setMoved((m) => { const n = { ...m }; delete n[id]; return n; }); } });
  });

  const k = useMemo(() => {
    const slotOf = new Map(d.slots.map((s) => [s.id, s]));
    const sum = (xs: Expense[]) => Math.round(xs.reduce((a, e) => a + perMonth(e), 0) * 100) / 100;
    // In person: every time slot that isn't "Online".
    const inSlots = d.slots.filter((s) => !isOnline(s)).map((s) => {
      const list = clients.filter((c) => c.slot_id === s.id).sort((a, b) => n(b.monthly) - n(a.monthly) || a.name.localeCompare(b.name));
      const income = list.reduce((a, c) => a + n(c.monthly), 0);
      return { s, list, income, paying: list.filter((c) => n(c.monthly) > 0).length, profit: income - n(s.rent) };
    });
    const inList = inSlots.flatMap((x) => x.list);
    const inIncome = inSlots.reduce((a, x) => a + x.income, 0), rent = inSlots.reduce((a, x) => a + n(x.s.rent), 0);
    const inPaying = inList.filter((c) => n(c.monthly) > 0).length;
    const inFull = inList.filter((c) => !n(c.monthly) && n(c.paid_amount) > 0).length; // November 19: paid in full counts as $0 a month here
    // Online: monthly payers, plus paid-in-full spread over the months she paid for (while it's still running).
    const onSlot = new Set(d.slots.filter(isOnline).map((s) => s.id));
    const onList = clients.filter((c) => c.slot_id && onSlot.has(c.slot_id)).map((c) => {
      const start = startOf(c);
      const running = !!c.paid_amount && (!c.expires_on || c.expires_on >= d.today);
      const months = c.paid_weeks ? c.paid_weeks / (52 / 12) : start && c.expires_on ? Math.max(1, monthsBetween(start, c.expires_on)) : null;
      const spread = running && months ? n(c.paid_amount) / months : 0;
      return { c, start, running, months, perMonth: n(c.monthly) + spread };
    }).sort((a, b) => (b.start ?? "").localeCompare(a.start ?? ""));
    const onIncome = onList.reduce((a, x) => a + x.perMonth, 0);
    const onMonthly = onList.filter((x) => n(x.c.monthly) > 0).length, onFull = onList.filter((x) => !n(x.c.monthly) && x.running).length;
    const loose = clients.filter((c) => !c.slot_id || !slotOf.has(c.slot_id));
    const biz = d.expenses.filter((e) => e.category === "business").sort(byDay), per = d.expenses.filter((e) => e.category === "personal").sort(byDay);
    const bizNow = sum(biz), perNow = sum(per), bizAfter = sum(biz.filter((e) => !e.canceling)), perAfter = sum(per.filter((e) => !e.canceling));
    const net = inIncome - rent + onIncome - bizNow - perNow, netAfter = inIncome - rent + onIncome - bizAfter - perAfter;
    return {
      slotOf, inSlots, inList, inIncome, rent, inPaying, inFull, inFree: inList.length - inPaying - inFull, inAvg: inPaying ? (inIncome - rent) / inPaying : 0,
      onList, onIncome, onMonthly, onFull, onFree: onList.length - onMonthly - onFull, onAvg: onMonthly + onFull ? onIncome / (onMonthly + onFull) : 0,
      loose, biz, per, bizNow, perNow, bizAfter, perAfter, net, netAfter, canceling: d.expenses.filter((e) => e.canceling),
    };
  }, [d, clients]);

  // ── Editing ─────────────────────────────────────────────
  const slotOptions: [string, string][] = [["", "No time slot"], ...d.slots.map((s) => [s.id, s.name] as [string, string])];
  const FORMS: Record<KpiTable, Field[]> = {
    kpi_expenses: [
      { k: "name", label: "Name", kind: "text", wide: true },
      { k: "category", label: "Business or personal", kind: "select", options: [["business", "Business"], ["personal", "Personal"]] },
      { k: "amount", label: "Amount ($)", kind: "num" },
      { k: "frequency", label: "How often", kind: "select", options: [["monthly", "Every month"], ["biweekly", "Every 2 weeks"], ["weekly", "Every week"], ["yearly", "Every year"]] },
      { k: "draw_day", label: "Day of the month it comes out (1–31)", kind: "num" },
      { k: "canceling", label: "Planning to cancel", kind: "bool" },
      { k: "notes", label: "Notes", kind: "area", wide: true },
    ],
    kpi_slots: [
      { k: "name", label: "Time slot (e.g. 5am, Online)", kind: "text", wide: true },
      { k: "rent", label: "Rent per month ($)", kind: "num" },
      { k: "plan_2027", label: "2027 plan: profit per month ($)", kind: "num" },
      { k: "plan_note", label: "2027 plan note", kind: "text", wide: true },
      { k: "position", label: "Order (1 = first)", kind: "num" },
    ],
    kpi_clients: [
      { k: "name", label: "Name", kind: "text", wide: true },
      { k: "slot_id", label: "Time slot", kind: "select", options: slotOptions },
      { k: "monthly", label: "Pays per month ($)", kind: "num" },
      { k: "paid_amount", label: "Paid in full ($)", kind: "num" },
      { k: "paid_weeks", label: "…for how many weeks", kind: "num" },
      { k: "started_on", label: "Signed up on", kind: "date" },
      { k: "expires_on", label: "Paid until / expires", kind: "date" },
      { k: "renewal_offer", label: "Renewal offer ($)", kind: "num" },
      { k: "notes", label: "Notes", kind: "area", wide: true },
    ],
    kpi_payments: [
      { k: "name", label: "Who / what", kind: "text", wide: true },
      { k: "client_id", label: "Client (optional)", kind: "select", options: [["", "—"], ...d.clients.map((c) => [c.id, c.name] as [string, string])] },
      { k: "amount", label: "Amount ($)", kind: "num" },
      { k: "paid_on", label: "Paid on", kind: "date" },
      { k: "notes", label: "Notes", kind: "area", wide: true },
    ],
  };
  const open = (table: KpiTable, title: string, row?: Record<string, unknown>, defaults: Record<string, unknown> = {}) => {
    const f: Record<string, unknown> = {};
    for (const fl of FORMS[table]) f[fl.k] = row ? (row[fl.k] ?? (fl.kind === "bool" ? false : "")) : (defaults[fl.k] ?? (fl.kind === "bool" ? false : fl.kind === "select" ? fl.options?.[0]?.[0] ?? "" : ""));
    setEdit({ table, id: (row?.id as string) ?? null, title, f }); setErr(""); setSure(false);
  };

  // ── Pieces ──────────────────────────────────────────────
  const add = "inline-flex min-h-9 items-center rounded-lg border border-dashed border-[#3a3a3a] px-3 text-[13px] font-semibold text-accent";
  return (
    <div className="space-y-4">
      {/* 1. In person */}
      <Summary label="In-person training income / mo" big={money(k.inIncome)}
        lines={[<>{k.inList.length} in-person clients: {k.inPaying} paying{k.inFull ? `, ${k.inFull} paid in full` : ""}, {k.inFree} free</>,
          <>− {money(k.rent)} rent = <b>{money(k.inIncome - k.rent)} profit</b> · {money(Math.round(k.inAvg))} average profit per paying client</>]}>
        <p className="text-[12px] text-dim">Drag a name to another time slot (on a phone, use the dots). Tap a name to edit, tap a time slot to change its rent.</p>
        <div className="space-y-2.5">
          {k.inSlots.map(({ s, list, income, paying, profit }) => (
            <div key={s.id} data-drop={s.id} className={`overflow-hidden rounded-xl border transition ${dnd.over === s.id ? "border-accent ring-2 ring-accent" : "border-border"}`}>
              <button type="button" onClick={() => open("kpi_slots", "Edit time slot", s)} className="flex w-full items-baseline justify-between gap-2 bg-[#151515] px-3 py-2 text-left text-[13px] hover:text-accent">
                <b>{s.name}</b>
                <span className="text-right text-dim">{money(income)} income · {n(s.rent) ? `${money(n(s.rent))} rent` : "no rent"} · <b className="text-text">{money(profit)}</b> profit<span className="block text-[11px]">{list.length} client{list.length === 1 ? "" : "s"} · {paying} paying{s.plan_2027 != null ? ` · 2027 plan ${money(n(s.plan_2027))}` : ""}</span></span>
              </button>
              <ul className="divide-y divide-border">
                {list.map((c) => (
                  <li key={c.id} {...dnd.bind(c.id, c.name)} className="flex items-center gap-2 px-2 hover:bg-[#161616]">
                    <Grip />
                    <button type="button" onClick={() => open("kpi_clients", "Edit client", c)} className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-2 text-left">
                      <span className="min-w-0 truncate text-[14px]">{c.name}
                        {!n(c.monthly) && n(c.paid_amount) > 0 && (
                          <span className="block truncate text-[12px] text-[#cfcfcf]">Paid in full: {money(n(c.paid_amount))}{startOf(c) ? ` · signed up ${dateNice(startOf(c)!)}` : ""}{c.expires_on ? ` · ${c.expires_on < d.today ? "expired" : "expires"} ${dateNice(c.expires_on)}` : ""}</span>
                        )}
                        {c.notes && <span className="block truncate text-[11px] text-dim">{c.notes}</span>}</span>
                      <span className={`shrink-0 text-[13px] tabular-nums ${n(c.monthly) ? "font-semibold" : "text-dim"}`}>{n(c.monthly) ? `${money(n(c.monthly))}/mo` : n(c.paid_amount) ? "$0/mo" : "free"}</span>
                    </button>
                  </li>
                ))}
                {!list.length && <li className="px-3 py-2 text-[12px] text-dim">Nobody yet. Drag someone here.</li>}
              </ul>
              <div className="px-3 py-2"><button type="button" onClick={() => open("kpi_clients", `Add a client to ${s.name}`, undefined, { slot_id: s.id })} className={add}>+ Client</button></div>
            </div>
          ))}
        </div>
        {k.loose.length > 0 && (
          <div data-drop="none" className="overflow-hidden rounded-xl border border-border">
            <div className="bg-[#151515] px-3 py-2 text-[13px] font-semibold">No time slot (drag them into one)</div>
            <ul className="divide-y divide-border">{k.loose.map((c) => (
              <li key={c.id} {...dnd.bind(c.id, c.name)} className="flex items-center gap-2 px-2"><Grip /><button type="button" onClick={() => open("kpi_clients", "Edit client", c)} className="min-h-10 flex-1 text-left text-[14px]">{c.name}</button></li>
            ))}</ul>
          </div>
        )}
        <button type="button" onClick={() => open("kpi_slots", "Add a time slot", undefined, { position: d.slots.length + 1 })} className={add}>+ Time slot</button>
        {dnd.ghost}
      </Summary>

      {/* 2. Online */}
      <Summary label="Online training income / mo" big={money(Math.round(k.onIncome))}
        lines={[<>{k.onList.length} online clients: {k.onMonthly} paying monthly, {k.onFull} paid in full{k.onFree ? `, ${k.onFree} free or expired` : ""}</>,
          <>{money(Math.round(k.onAvg))} average profit per paying client · paid in full is spread over the months she paid for</>]}>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#151515] text-[11px] uppercase tracking-wide text-dim"><tr><th className="p-2">Client</th><th className="p-2">Signed up</th><th className="p-2">Expires</th><th className="p-2 text-right">Paid</th><th className="p-2">For</th><th className="p-2 text-right">Per month</th></tr></thead>
            <tbody className="divide-y divide-border tabular-nums">
              {k.onList.map(({ c, start, running, perMonth: pm }) => (
                <tr key={c.id} onClick={() => open("kpi_clients", "Edit client", c)} className="cursor-pointer hover:bg-[#161616]">
                  <td className="p-2 font-semibold">{c.name}</td>
                  <td className="whitespace-nowrap p-2 text-dim">{start ? dateNice(start) : "—"}</td>
                  <td className={`whitespace-nowrap p-2 ${c.expires_on && c.expires_on < d.today ? "text-[#ff8a8a]" : ""}`}>{c.expires_on ? `${dateNice(c.expires_on)}${c.expires_on < d.today ? " (expired)" : ""}` : n(c.monthly) ? "monthly" : "—"}</td>
                  <td className="p-2 text-right">{c.paid_amount ? money(n(c.paid_amount)) : n(c.monthly) ? `${money(n(c.monthly))}/mo` : "free"}</td>
                  <td className="whitespace-nowrap p-2 text-dim">{c.paid_weeks ? `${c.paid_weeks} weeks` : "—"}</td>
                  <td className={`p-2 text-right ${running || n(c.monthly) ? "font-semibold" : "text-dim"}`}>{pm ? money(Math.round(pm)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => open("kpi_clients", "Add an online client", undefined, { slot_id: d.slots.find(isOnline)?.id ?? "", started_on: d.today })} className={add}>+ Online client</button>
      </Summary>

      {/* 3 and 4. Expenses */}
      {([["business", "Business expenses / mo", k.biz, k.bizNow, k.bizAfter], ["personal", "Personal expenses / mo", k.per, k.perNow, k.perAfter]] as const).map(([cat, title, list, now, after]) => (
        <Summary key={cat} label={title} big={money(now)} lines={[<>{list.length} expense{list.length === 1 ? "" : "s"}{list.some((e) => e.draw_day) ? "" : " · tap one to add the day it comes out"}</>,
          after !== now ? <>{money(after)} a month after canceling {list.filter((e) => e.canceling).length}</> : <>Nothing marked to cancel</>]}>
          {/* November 19: sort by cost, A to Z, or the day it comes out. */}
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="text-dim">Sort:</span>
            {([["cost", "Cost"], ["az", "A–Z"], ["day", "Day of the month"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setExpSort(v)} aria-pressed={expSort === v}
                className={`min-h-8 rounded-full border px-3 ${expSort === v ? "border-accent font-semibold text-accent" : "border-border text-dim"}`}>{l}</button>
            ))}
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {[...list].sort(expSort === "az" ? (a, b) => a.name.localeCompare(b.name) : expSort === "day" ? byDay : (a, b) => perMonth(b) - perMonth(a) || a.name.localeCompare(b.name)).map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => open("kpi_expenses", "Edit expense", e)} className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#161616] ${e.canceling ? "opacity-60" : ""}`}>
                  <span className="w-16 shrink-0 text-[12px] text-dim">{e.draw_day ? `the ${ordinal(e.draw_day)}` : "day ?"}</span>
                  <span className="min-w-0 flex-1 text-[14px]">{e.name}{e.canceling && <span className="ml-1.5 rounded bg-[#3a1d1d] px-1.5 text-[11px] text-[#ff8a8a]">canceling</span>}
                    {e.frequency !== "monthly" && <span className="block text-[12px] text-dim">{money(n(e.amount))} every {e.frequency === "biweekly" ? "2 weeks" : e.frequency === "weekly" ? "week" : "year"}</span>}</span>
                  <span className={`shrink-0 text-[14px] tabular-nums ${e.canceling ? "line-through" : ""}`}>{money(perMonth(e))}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => open("kpi_expenses", `Add a ${cat} expense`, undefined, { category: cat, frequency: "monthly" })} className={add}>+ Expense</button>
        </Summary>
      ))}

      {/* 5. Net */}
      <Summary label="Net profit / loss per month" big={money(Math.round(k.net))} tone={k.net < 0 ? "bad" : "good"}
        lines={[<>{money(k.inIncome - k.rent)} in person (after rent) + {money(Math.round(k.onIncome))} online</>,
          <>− {money(k.bizNow)} business − {money(k.perNow)} personal{k.canceling.length ? ` · ${money(Math.round(k.netAfter))} after canceling ${k.canceling.length}` : ""}</>]} />

      {/* 6–8. The planner */}
      {planReady ? <>
        <Section title="Action plan" icon="targets" open><ActionPlan plan={plan} /></Section>
        <Section title="Eisenhower matrix" icon="checkins" open><Matrix plan={plan} /></Section>
        <Section title="Brain dump & projects" icon="progress" open><Outline plan={plan} /></Section>
      </> : <p className="rounded-xl border border-[#3a2f12] bg-[#1a150a] p-3 text-[14px] text-[#e7d3a8]">Run the 32 KPI planner SQL file in Supabase to turn on your action plan, Eisenhower matrix and outline.</p>}

      {edit && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={edit.title}>
          <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveKpi(edit.table, edit.id, edit.f); if (r?.error) setErr(r.error); else setEdit(null); }); }}
            className="max-h-[90dvh] w-full max-w-lg space-y-2.5 overflow-y-auto rounded-[20px] border border-border bg-[#121212] p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-xl uppercase">{edit.title}</h2>
              <button type="button" onClick={() => setEdit(null)} className="min-h-9 px-2 text-dim" aria-label="Close">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FORMS[edit.table].map((fl) => {
                const v = edit.f[fl.k];
                const set = (x: unknown) => setEdit({ ...edit, f: { ...edit.f, [fl.k]: x } });
                const box = "min-h-11 rounded-xl border border-border bg-card px-3 text-[15px] text-text outline-none focus:border-accent";
                if (fl.kind === "bool") return (
                  <label key={fl.k} className="col-span-2 flex min-h-11 items-center gap-2 text-[14px]"><input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} className="size-5 accent-[var(--accent)]" />{fl.label}</label>
                );
                return (
                  <label key={fl.k} className={`flex flex-col gap-1 text-[12px] text-dim ${fl.wide || fl.kind === "area" ? "col-span-2" : ""}`}>
                    {fl.label}
                    {fl.kind === "area" ? <textarea value={String(v ?? "")} onChange={(e) => set(e.target.value)} rows={2} className="rounded-xl border border-border bg-card p-2.5 text-[15px] text-text outline-none focus:border-accent" />
                      : fl.kind === "select" ? <select value={String(v ?? "")} onChange={(e) => set(e.target.value)} className={box}>{fl.options!.map(([ov, ol]) => <option key={ov} value={ov}>{ol}</option>)}</select>
                      : <input type={fl.kind === "date" ? "date" : "text"} inputMode={fl.kind === "num" ? "decimal" : undefined} value={String(v ?? "")} onChange={(e) => set(e.target.value)} autoFocus={fl.k === "name" && !edit.id} className={box} />}
                  </label>
                );
              })}
            </div>
            {err && <p className="text-sm text-[var(--red)]">{err}</p>}
            <button disabled={pending} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-black disabled:opacity-50">{pending ? "Saving…" : edit.id ? "Save" : "Add"}</button>
            {edit.id && (sure
              ? <button type="button" disabled={pending} onClick={() => start(async () => { const r = await deleteKpi(edit.table, edit.id!); if (r?.error) setErr(r.error); else setEdit(null); })} className="min-h-11 w-full rounded-xl border border-[var(--red)] text-[14px] text-[var(--red)]">Yes, delete it</button>
              : <button type="button" onClick={() => setSure(true)} className="min-h-11 w-full text-[14px] text-[var(--red)]">Delete</button>)}
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * One of the big numbers at the top. November 19: the number on the left, two easy-to-read lines on the right, as tall
 * as the number. Tap it to open the details (it slides open).
 */
function Summary({ label, big, lines, children, tone }: { label: string; big: string; lines: [React.ReactNode, React.ReactNode]; children?: React.ReactNode; tone?: "good" | "bad" }) {
  const head = (
    <>
      <span className="shrink-0">
        <span className="block text-[11px] uppercase tracking-[0.12em] text-dim">{label}</span>
        <span className={`mt-0.5 block font-[family-name:var(--font-display)] text-[34px] leading-[36px] tabular-nums ${tone === "good" ? "text-[#7ddc8f]" : tone === "bad" ? "text-[#ff8a8a]" : ""}`}>{big}</span>
      </span>
      <span className="min-w-0 flex-1 self-end text-[14px] leading-[18px] text-[#e2e2e2]">
        <span className="block">{lines[0]}</span>
        <span className="block">{lines[1]}</span>
      </span>
    </>
  );
  if (!children) return <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3">{head}</div>;
  return (
    <details data-drawer className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3">
        {head}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden="true" className="shrink-0 transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="space-y-2.5 px-3 pb-3">{children}</div>
    </details>
  );
}
