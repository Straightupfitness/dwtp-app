"use client";
import { useMemo, useState, useTransition } from "react";
import Section from "@/components/Section";
import { deleteKpi, saveKpi, type KpiTable } from "./actions";

type Expense = { id: string; name: string; category: "business" | "personal"; amount: number; frequency: "weekly" | "biweekly" | "monthly" | "yearly"; canceling: boolean; notes: string | null; position: number };
type Slot = { id: string; name: string; rent: number; plan_2027: number | null; plan_note: string | null; position: number };
type Client = { id: string; slot_id: string | null; name: string; monthly: number; paid_amount: number | null; paid_weeks: number | null; expires_on: string | null; renewal_offer: number | null; notes: string | null; position: number };
type Payment = { id: string; client_id: string | null; name: string; amount: number; paid_on: string; notes: string | null };
export type Data = { expenses: Expense[]; slots: Slot[]; clients: Client[]; payments: Payment[]; leads: (string | null)[]; today: string };

const n = (x: unknown) => Number(x ?? 0) || 0;
const money = (x: number) => `${x < 0 ? "−" : ""}$${Math.abs(x).toLocaleString("en-US", { maximumFractionDigits: Math.abs(x) % 1 ? 2 : 0, minimumFractionDigits: Math.abs(x) % 1 ? 2 : 0 })}`;
const PER_MONTH = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, yearly: 1 / 12 } as const;
const perMonth = (e: Expense) => Math.round(n(e.amount) * PER_MONTH[e.frequency] * 100) / 100;
const dateNice = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const monthNice = (ym: string) => new Date(ym + "-15T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const isOnline = (s: Slot | undefined) => !!s && /online/i.test(s.name);

type Field = { k: string; label: string; kind: "text" | "num" | "date" | "area" | "bool" | "select"; options?: [string, string][]; wide?: boolean };
type Edit = { table: KpiTable; id: string | null; title: string; f: Record<string, unknown> };

/**
 * November 17 (Michael): his KPIs. Tiles up top (profit, expenses, net, break-even, clients, renewals, leads), then
 * income by time slot (with the 2027 plan), renewals coming up, one-time payments and expenses. Everything is
 * editable: tap a row to change it, or add one.
 */
export default function KpiView({ d }: { d: Data }) {
  const [edit, setEdit] = useState<Edit | null>(null);
  const [err, setErr] = useState("");
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();
  const month = d.today.slice(0, 7);

  const k = useMemo(() => {
    const slotOf = new Map(d.slots.map((s) => [s.id, s]));
    const bySlot = d.slots.map((s) => {
      const list = d.clients.filter((c) => c.slot_id === s.id);
      const income = list.reduce((a, c) => a + n(c.monthly), 0);
      return { s, list, income, paying: list.filter((c) => n(c.monthly) > 0).length, profit: income - n(s.rent) };
    });
    const loose = d.clients.filter((c) => !c.slot_id || !slotOf.has(c.slot_id));
    const income = d.clients.reduce((a, c) => a + n(c.monthly), 0);
    const rent = d.slots.reduce((a, s) => a + n(s.rent), 0);
    const profit = income - rent;
    const sum = (xs: Expense[]) => Math.round(xs.reduce((a, e) => a + perMonth(e), 0) * 100) / 100;
    const biz = d.expenses.filter((e) => e.category === "business"), per = d.expenses.filter((e) => e.category === "personal");
    const expNow = sum(d.expenses), expAfter = sum(d.expenses.filter((e) => !e.canceling));
    const paying = d.clients.filter((c) => n(c.monthly) > 0);
    const online = paying.filter((c) => isOnline(slotOf.get(c.slot_id ?? ""))).length;
    const free = d.clients.filter((c) => n(c.monthly) === 0 && !(c.expires_on && c.expires_on >= d.today)).length;
    const prepaid = d.clients.filter((c) => n(c.monthly) === 0 && c.expires_on && c.expires_on >= d.today).length;
    const oneTime = d.payments.filter((p) => p.paid_on.startsWith(month));
    // Renewals: anyone whose paid-in-full time ends, overdue ones first, then month by month for the next 6 months.
    const in6 = new Date(d.today + "T12:00:00Z"); in6.setUTCMonth(in6.getUTCMonth() + 6);
    const until = in6.toISOString().slice(0, 10);
    const ren = d.clients.filter((c) => c.expires_on && c.expires_on <= until).map((c) => ({ c, amount: n(c.renewal_offer ?? c.paid_amount) }))
      .sort((a, b) => a.c.expires_on!.localeCompare(b.c.expires_on!));
    const overdue = ren.filter((r) => r.c.expires_on! < d.today);
    const coming = ren.filter((r) => r.c.expires_on! >= d.today);
    const in90 = new Date(d.today + "T12:00:00Z"); in90.setUTCDate(in90.getUTCDate() + 90);
    const next90 = coming.filter((r) => r.c.expires_on! <= in90.toISOString().slice(0, 10));
    const plan = d.slots.reduce((a, s) => a + n(s.plan_2027), 0);
    const leads = { hot: d.leads.filter((t) => t === "hot").length, warm: d.leads.filter((t) => t === "warm").length, cold: d.leads.filter((t) => t === "cold").length, total: d.leads.length };
    return {
      slotOf, bySlot, loose, income, rent, profit, biz, per, bizNow: sum(biz), bizAfter: sum(biz.filter((e) => !e.canceling)), perNow: sum(per), perAfter: sum(per.filter((e) => !e.canceling)),
      expNow, expAfter, net: profit - expNow, netAfter: profit - expAfter, canceling: d.expenses.filter((e) => e.canceling),
      paying: paying.length, online, inPerson: paying.length - online, free, prepaid, avg: paying.length ? income / paying.length : 0,
      oneTime, oneTimeSum: oneTime.reduce((a, p) => a + n(p.amount), 0), overdue, coming, next90, plan, leads,
    };
  }, [d, month]);

  // ── Editing ─────────────────────────────────────────────
  const slotOptions: [string, string][] = [["", "No time slot"], ...d.slots.map((s) => [s.id, s.name] as [string, string])];
  const FORMS: Record<KpiTable, Field[]> = {
    kpi_expenses: [
      { k: "name", label: "Name", kind: "text", wide: true },
      { k: "category", label: "Business or personal", kind: "select", options: [["business", "Business"], ["personal", "Personal"]] },
      { k: "amount", label: "Amount ($)", kind: "num" },
      { k: "frequency", label: "How often", kind: "select", options: [["monthly", "Every month"], ["biweekly", "Every 2 weeks"], ["weekly", "Every week"], ["yearly", "Every year"]] },
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
  const tile = "rounded-2xl border border-border bg-card p-3.5";
  const label = "text-[11px] uppercase tracking-[0.12em] text-dim";
  const big = "mt-1 font-[family-name:var(--font-display)] text-[28px] leading-none tabular-nums";
  const add = "inline-flex min-h-9 items-center rounded-lg border border-dashed border-[#3a3a3a] px-3 text-[13px] font-semibold text-accent";
  const ClientRow = ({ c }: { c: Client }) => (
    <button type="button" onClick={() => open("kpi_clients", "Edit client", c)} className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-[#161616]">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{c.name}</span>
        {(c.paid_amount || c.expires_on || c.renewal_offer || c.notes) && (
          <span className="block text-[12px] text-dim">
            {[c.paid_amount ? `Paid ${money(n(c.paid_amount))}${c.paid_weeks ? ` for ${c.paid_weeks} weeks` : ""}` : null,
              c.expires_on ? `${c.expires_on < d.today ? "expired" : "until"} ${dateNice(c.expires_on)}` : null,
              c.renewal_offer ? `renewal offer ${money(n(c.renewal_offer))}` : null, c.notes].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      <span className={`shrink-0 text-[14px] tabular-nums ${n(c.monthly) ? "font-semibold" : "text-dim"}`}>{n(c.monthly) ? `${money(n(c.monthly))}/mo` : c.expires_on && c.expires_on >= d.today ? "paid in full" : "free"}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Tiles */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <div className={tile}><p className={label}>Training profit / mo</p><p className={big}>{money(k.profit)}</p><p className="mt-1 text-[12px] text-dim">{money(k.income)} income − {money(k.rent)} rent</p></div>
        <div className={tile}><p className={label}>Expenses / mo</p><p className={big}>{money(k.expNow)}</p><p className="mt-1 text-[12px] text-dim">{money(k.bizNow)} business · {money(k.perNow)} personal{k.canceling.length ? <><br />{money(k.expAfter)} after canceling {k.canceling.length}</> : null}</p></div>
        <div className={tile}><p className={label}>Net / mo</p><p className={`${big} ${k.net < 0 ? "text-[#ff8a8a]" : "text-[#7ddc8f]"}`}>{money(k.net)}</p>{k.canceling.length > 0 && <p className="mt-1 text-[12px] text-dim">{money(k.netAfter)} after cancellations</p>}</div>
        <div className={tile}><p className={label}>Break-even</p><p className={big}>{k.net < 0 ? `+${money(-k.net)}` : "Covered"}</p><p className="mt-1 text-[12px] text-dim">{k.net < 0 ? "more income a month to cover everything" : `${money(k.net)} a month left over`}</p></div>
        <div className={tile}><p className={label}>Paying clients</p><p className={big}>{k.paying}</p><p className="mt-1 text-[12px] text-dim">{k.inPerson} in person · {k.online} online<br />{k.prepaid} paid in full · {k.free} free</p></div>
        <div className={tile}><p className={label}>Average per paying client</p><p className={big}>{money(Math.round(k.avg))}</p><p className="mt-1 text-[12px] text-dim">a month</p></div>
        <div className={tile}><p className={label}>One-time payments</p><p className={big}>{money(k.oneTimeSum)}</p><p className="mt-1 text-[12px] text-dim">{monthNice(month)} · {k.oneTime.length} payment{k.oneTime.length === 1 ? "" : "s"}</p></div>
        <div className={tile}><p className={label}>Renewals next 90 days</p><p className={big}>{money(k.next90.reduce((a, r) => a + r.amount, 0))}</p><p className="mt-1 text-[12px] text-dim">{k.next90.length} coming up{k.overdue.length ? ` · ${k.overdue.length} already expired` : ""}</p></div>
        <div className={tile}><p className={label}>2027 plan</p><p className={big}>{money(k.plan)}</p><p className="mt-1 text-[12px] text-dim">profit a month · now {money(k.profit)} ({k.plan ? `${money(k.plan - k.profit)} to go` : "set it per time slot"})</p></div>
        <div className={tile}><p className={label}>Leads</p><p className={`${big} text-[22px]`}>🔥 {k.leads.hot} ☀️ {k.leads.warm} ❄️ {k.leads.cold}</p><p className="mt-1 text-[12px] text-dim">{k.leads.total} leads in all</p></div>
      </div>

      {/* Income by time slot */}
      <Section title="Income by time slot" icon="progress" open right={<span className="text-[13px] normal-case tracking-normal text-dim">{money(k.profit)} profit / mo</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide text-dim"><tr className="border-b border-border"><th className="py-2 pr-2">Time slot</th><th className="p-2 text-right">Paying</th><th className="p-2 text-right">Income</th><th className="p-2 text-right">Rent</th><th className="p-2 text-right">Profit</th><th className="p-2 text-right">2027 plan</th></tr></thead>
            <tbody className="divide-y divide-border tabular-nums">
              {k.bySlot.map(({ s, income, paying, profit }) => (
                <tr key={s.id}>
                  <td className="py-2 pr-2"><button type="button" onClick={() => open("kpi_slots", "Edit time slot", s)} className="font-semibold hover:text-accent">{s.name}</button></td>
                  <td className="p-2 text-right">{paying}</td><td className="p-2 text-right">{money(income)}</td><td className="p-2 text-right text-dim">{n(s.rent) ? money(n(s.rent)) : "—"}</td>
                  <td className="p-2 text-right font-semibold">{money(profit)}</td>
                  <td className="p-2 text-right" title={s.plan_note ?? ""}>{s.plan_2027 != null ? money(n(s.plan_2027)) : "—"}{s.plan_note && <span className="block text-[11px] text-dim">{s.plan_note}</span>}</td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="py-2 pr-2">Total</td><td className="p-2 text-right">{k.paying}</td><td className="p-2 text-right">{money(k.income)}</td><td className="p-2 text-right">{money(k.rent)}</td><td className="p-2 text-right text-accent">{money(k.profit)}</td><td className="p-2 text-right">{money(k.plan)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="space-y-3 pt-2">
          {k.bySlot.map(({ s, list, income }) => (
            <div key={s.id} className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between bg-[#151515] px-3 py-2 text-[13px]"><b>{s.name}</b><span className="text-dim">{list.length} client{list.length === 1 ? "" : "s"} · {money(income)}/mo</span></div>
              <div className="divide-y divide-border">{list.map((c) => <ClientRow key={c.id} c={c} />)}</div>
              <div className="px-3 py-2"><button type="button" onClick={() => open("kpi_clients", `Add a client to ${s.name}`, undefined, { slot_id: s.id })} className={add}>+ Client</button></div>
            </div>
          ))}
          {k.loose.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="bg-[#151515] px-3 py-2 text-[13px] font-semibold">No time slot</div>
              <div className="divide-y divide-border">{k.loose.map((c) => <ClientRow key={c.id} c={c} />)}</div>
            </div>
          )}
          <button type="button" onClick={() => open("kpi_slots", "Add a time slot", undefined, { position: d.slots.length + 1 })} className={add}>+ Time slot</button>
        </div>
      </Section>

      {/* Renewals */}
      <Section title="Renewals coming up" icon="targets" open right={<span className="text-[13px] normal-case tracking-normal text-dim">next 6 months</span>}>
        {k.overdue.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ff8a8a]">Already expired · {money(k.overdue.reduce((a, r) => a + r.amount, 0))}</p>
            {k.overdue.map(({ c, amount }) => <RenewRow key={c.id} c={c} amount={amount} onOpen={() => open("kpi_clients", "Edit client", c)} slot={k.slotOf.get(c.slot_id ?? "")?.name} />)}
          </div>
        )}
        {Object.entries(k.coming.reduce<Record<string, typeof k.coming>>((g, r) => { (g[r.c.expires_on!.slice(0, 7)] ??= []).push(r); return g; }, {})).map(([ym, rows]) => (
          <div key={ym} className="space-y-1 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">{monthNice(ym)} · {money(rows.reduce((a, r) => a + r.amount, 0))}</p>
            {rows.map(({ c, amount }) => <RenewRow key={c.id} c={c} amount={amount} onOpen={() => open("kpi_clients", "Edit client", c)} slot={k.slotOf.get(c.slot_id ?? "")?.name} />)}
          </div>
        ))}
        {!k.overdue.length && !k.coming.length && <p className="text-sm text-dim">Nothing in the next 6 months. Add a “paid until” date to a client to see her here.</p>}
      </Section>

      {/* One-time payments */}
      <Section title="One-time payments" icon="badges" open right={<span className="text-[13px] normal-case tracking-normal text-dim">{money(k.oneTimeSum)} this month</span>}>
        <div className="divide-y divide-border rounded-xl border border-border">
          {d.payments.map((p) => (
            <button key={p.id} type="button" onClick={() => open("kpi_payments", "Edit payment", p)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#161616]">
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{p.name || d.clients.find((c) => c.id === p.client_id)?.name || "Payment"}</span>{p.notes && <span className="block text-[12px] text-dim">{p.notes}</span>}</span>
              <span className="shrink-0 text-[12px] text-dim">{dateNice(p.paid_on)}</span>
              <span className="w-20 shrink-0 text-right text-[14px] font-semibold tabular-nums">{money(n(p.amount))}</span>
            </button>
          ))}
          {!d.payments.length && <p className="p-3 text-sm text-dim">No one-time payments yet.</p>}
        </div>
        <button type="button" onClick={() => open("kpi_payments", "Add a payment", undefined, { paid_on: d.today })} className={add}>+ Payment</button>
      </Section>

      {/* Expenses */}
      <Section title="Expenses" icon="checkins" open right={<span className="text-[13px] normal-case tracking-normal text-dim">{money(k.expNow)} / mo</span>}>
        <div className="grid gap-3 md:grid-cols-2">
          {([["business", "Business", k.biz, k.bizNow, k.bizAfter], ["personal", "Personal", k.per, k.perNow, k.perAfter]] as const).map(([cat, title, list, now, after]) => (
            <div key={cat} className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between bg-[#151515] px-3 py-2 text-[13px]"><b>{title}</b><span className="text-dim">{money(now)}/mo{after !== now ? ` · ${money(after)} after canceling` : ""}</span></div>
              <div className="divide-y divide-border">
                {list.map((e) => (
                  <button key={e.id} type="button" onClick={() => open("kpi_expenses", "Edit expense", e)} className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#161616] ${e.canceling ? "opacity-60" : ""}`}>
                    <span className="min-w-0 flex-1 text-[14px]">{e.name}{e.canceling && <span className="ml-1.5 rounded bg-[#3a1d1d] px-1.5 text-[11px] text-[#ff8a8a]">canceling</span>}
                      {e.frequency !== "monthly" && <span className="block text-[12px] text-dim">{money(n(e.amount))} every {e.frequency === "biweekly" ? "2 weeks" : e.frequency === "weekly" ? "week" : "year"}</span>}</span>
                    <span className={`shrink-0 text-[14px] tabular-nums ${e.canceling ? "line-through" : ""}`}>{money(perMonth(e))}</span>
                  </button>
                ))}
              </div>
              <div className="px-3 py-2"><button type="button" onClick={() => open("kpi_expenses", `Add a ${cat} expense`, undefined, { category: cat, frequency: "monthly" })} className={add}>+ Expense</button></div>
            </div>
          ))}
        </div>
      </Section>

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

function RenewRow({ c, amount, onOpen, slot }: { c: Client; amount: number; onOpen: () => void; slot?: string }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-[#161616]">
      <span className="w-24 shrink-0 text-[12px] text-dim">{dateNice(c.expires_on!)}</span>
      <span className="min-w-0 flex-1 text-[14px]">{c.name}{slot && <span className="text-[12px] text-dim"> · {slot}</span>}</span>
      <span className="shrink-0 text-right text-[13px] tabular-nums">{amount ? money(amount) : "—"}<span className="block text-[11px] text-dim">{c.renewal_offer ? "offer" : c.paid_amount ? "last paid" : ""}</span></span>
    </button>
  );
}
