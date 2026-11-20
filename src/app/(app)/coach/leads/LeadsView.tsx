"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { deleteLeads, importLeads, saveLead, setLeads, type LeadInput, type LeadType, type Temp } from "./actions";

export type Lead = {
  id: string; first_name: string; last_name: string; email: string | null; phone: string | null; city: string | null; goals: string | null; notes: string | null; source: string; created_at: string;
  lead_type?: "online" | "in_person" | null; time_slot?: string | null; lead_source?: string | null; contact_method?: string | null; temperature?: "hot" | "warm" | "cold" | "dead" | null;
  last_heard_on?: string | null; last_reached_on?: string | null; // November 19: last time she reached out / he did
  facebook?: string | null; instagram?: string | null; // November 20: her usernames, for Messenger and Instagram DMs
};

const EMPTY: LeadInput = { first_name: "", last_name: "", email: "", phone: "", city: "", goals: "", notes: "", lead_type: "", time_slot: "", lead_source: "", contact_method: "", temperature: "", facebook: "", instagram: "" };
const FIELDS: [keyof LeadInput, string, string][] = [
  ["first_name", "First name", "text"], ["last_name", "Last name", "text"], ["phone", "Phone", "tel"], ["email", "Email", "email"],
  ["time_slot", "Time slot", "text"], ["city", "City she lives in", "text"], ["lead_source", "Source (where you got her)", "text"],
  ["contact_method", "Main way you talk (Txt, IG DM…)", "text"], ["facebook", "Facebook (username or profile link)", "text"], ["instagram", "Instagram (username)", "text"],
  ["notes", "Notes", "area"], ["goals", "Her goals", "area"],
];
// November 17: how hot she is, and online or in person.
const TEMPS: { v: Exclude<Temp, "">; label: string; icon: string; on: string }[] = [
  { v: "hot", label: "Hot", icon: "🔥", on: "border-[#ef4444] bg-[#ef4444]/20 text-[#ff8a8a]" },
  { v: "warm", label: "Warm", icon: "☀️", on: "border-[#f5a623] bg-[#f5a623]/20 text-[#ffc76b]" },
  { v: "cold", label: "Cold", icon: "❄️", on: "border-[#60a5fa] bg-[#60a5fa]/20 text-[#9cc8ff]" },
  { v: "dead", label: "Dead", icon: "🪦", on: "border-[#6b6b6b] bg-[#6b6b6b]/25 text-[#bdbdbd]" },
];
const TYPES: { v: Exclude<LeadType, "">; label: string }[] = [{ v: "online", label: "Online" }, { v: "in_person", label: "In person" }];
type SortBy = "new" | "status" | "first" | "last";
/** Sorting by status: hottest first, dead last. */
const TEMP_ORDER: Record<string, number> = { hot: 0, warm: 1, cold: 2, "": 3, dead: 4 };
const toInput = (l: Lead): LeadInput => ({
  first_name: l.first_name, last_name: l.last_name, email: l.email ?? "", phone: l.phone ?? "", city: l.city ?? "", goals: l.goals ?? "", notes: l.notes ?? "",
  lead_type: l.lead_type ?? "", time_slot: l.time_slot ?? "", lead_source: l.lead_source ?? "", contact_method: l.contact_method ?? "", temperature: l.temperature ?? "",
  facebook: l.facebook ?? "", instagram: l.instagram ?? "",
});
const fmtPhone = (p: string | null) => { const d = (p ?? "").replace(/\D/g, "").slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p ?? ""; };

/** One CSV line → cells (handles quotes). */
function cells(line: string, sep: string) {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}
/**
 * An uploaded list (CSV from GoHighLevel, a spreadsheet, or pasted). Columns are matched by their header:
 * first/last name, name, email, phone, city, goals, notes. Without a header: name, email, phone in that order.
 */
export function parseLeads(text: string): Partial<LeadInput>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(",") ? "," : lines[0].includes(";") ? ";" : ",";
  const head = cells(lines[0], sep).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const find = (...names: string[]) => head.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const col = {
    first: find("firstname", "first", "fname", "given"), last: find("lastname", "last", "lname", "surname", "family"),
    name: head.findIndex((h) => h === "name" || h === "fullname" || h === "contactname"),
    email: find("email", "mail"), phone: find("phone", "mobile", "cell", "number", "tel"),
    city: find("city", "town", "location"), goals: find("goal"), notes: find("note", "extra", "info", "comment", "tags"),
    time: find("timeslot", "time", "slot"), source: find("source", "leadsource", "from"), method: find("methodofcommunication", "method", "communication", "contactvia"),
    type: find("onlineorinperson", "leadtype", "type", "online", "inperson"), temp: find("temperature", "temp", "status", "hotwarm"),
  };
  const hasHeader = col.email >= 0 || col.phone >= 0 || col.first >= 0 || col.name >= 0;
  const body = hasHeader ? lines.slice(1) : lines;
  return body.map((l) => {
    const c = cells(l, sep);
    const get = (i: number) => (i >= 0 ? c[i] ?? "" : "");
    if (!hasHeader) {
      const email = c.find((x) => /@/.test(x)) ?? "", phone = c.find((x) => (x.replace(/\D/g, "").length >= 10 && !/@/.test(x))) ?? "";
      const name = c.find((x) => x && x !== email && x !== phone) ?? "";
      const [first, ...rest] = name.split(/\s+/);
      return { first_name: first ?? "", last_name: rest.join(" "), email, phone };
    }
    let first = get(col.first), last = get(col.last);
    if (!first && col.name >= 0) { const [f, ...r] = get(col.name).split(/\s+/); first = f ?? ""; last = last || r.join(" "); }
    const ty = get(col.type).toLowerCase(), te = get(col.temp).toLowerCase();
    return {
      first_name: first, last_name: last === "N/A" ? "" : last, email: get(col.email), phone: get(col.phone), city: get(col.city), goals: get(col.goals), notes: get(col.notes),
      time_slot: get(col.time), lead_source: get(col.source), contact_method: get(col.method),
      lead_type: /online/.test(ty) ? "online" : /person|local|gym/.test(ty) ? "in_person" : "",
      temperature: (["hot", "warm", "cold", "dead"].find((t) => te.includes(t)) ?? "") as Temp,
    };
  });
}

/**
 * November 15: Michael's Leads tab, like his Clients list. Add, edit, upload a list, tick several and text them from
 * his own phone (same fill-ins as for clients), or copy their emails.
 */
export default function LeadsView({ leads }: { leads: Lead[] }) {
  const [search, setSearch] = useState("");
  const [tempF, setTempF] = useState<Temp | "all" | "none">("all");
  const [typeF, setTypeF] = useState<LeadType | "all">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<{ id: string | null; f: LeadInput } | null>(null);
  const [upload, setUpload] = useState<{ text: string; rows: Partial<LeadInput>[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();

  // November 19: tap Status, First or Last to sort (tap again to flip). Newest first until she picks one.
  const [sort, setSort] = useState<{ by: SortBy; dir: 1 | -1 }>({ by: "new", dir: 1 });
  const sortBy = (by: SortBy) => setSort((cur) => ({ by, dir: cur.by === by ? (cur.dir === 1 ? -1 : 1) : 1 }));
  // November 19 (Michael): marking a lead (hot, warm…) never moves her. The order (and who's shown) is worked out only
  // when he changes the sort, a filter or the search, or a lead is added or removed.
  const idsKey = leads.map((l) => l.id).join(",");
  const [snap, setSnap] = useState({ key: idsKey, leads });
  if (snap.key !== idsKey) setSnap({ key: idsKey, leads });
  const order = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = snap.leads.filter((l) => (!q || [l.first_name, l.last_name, l.email, l.phone, l.city, l.goals, l.notes, l.lead_source, l.contact_method, l.time_slot].some((x) => (x ?? "").toLowerCase().includes(q)))
      && (tempF === "all" || (tempF === "none" ? !l.temperature : l.temperature === tempF))
      && (typeF === "all" || l.lead_type === typeF));
    const name = (x: string | null | undefined) => (x ?? "").trim().toLowerCase();
    const blankLast = (a: string, b: string) => (a === "" ? 1 : 0) - (b === "" ? 1 : 0); // empty names go to the bottom either way
    const cmp: Record<SortBy, (a: Lead, b: Lead) => number> = {
      new: (a, b) => b.created_at.localeCompare(a.created_at),
      status: (a, b) => (TEMP_ORDER[a.temperature ?? ""] - TEMP_ORDER[b.temperature ?? ""]) * sort.dir || name(a.first_name).localeCompare(name(b.first_name)),
      first: (a, b) => blankLast(name(a.first_name), name(b.first_name)) || name(a.first_name).localeCompare(name(b.first_name)) * sort.dir || name(a.last_name).localeCompare(name(b.last_name)),
      last: (a, b) => blankLast(name(a.last_name), name(b.last_name)) || name(a.last_name).localeCompare(name(b.last_name)) * sort.dir || name(a.first_name).localeCompare(name(b.first_name)),
    };
    return [...list].sort(cmp[sort.by]).map((l) => l.id);
  }, [snap, search, tempF, typeF, sort]);
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const shown = useMemo(() => order.map((id) => byId.get(id)).filter((l): l is Lead => !!l), [order, byId]);
  const [details, setDetails] = useState<Lead | null>(null);
  const mark = (ids: string[], patch: { temperature?: Temp; lead_type?: LeadType; last_heard_on?: string | null; last_reached_on?: string | null }) => start(async () => { const r = await setLeads(ids, patch); if (r?.error) setMsg(r.error); });
  const allPicked = shown.length > 0 && shown.every((l) => picked.has(l.id));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickedRows = leads.filter((l) => picked.has(l.id));
  const one = pickedRows.length === 1 ? pickedRows[0] : null;

  async function readFile(f?: File) {
    if (!f) return;
    const text = await f.text();
    setUpload({ text, rows: parseLeads(text) });
  }

  const act = "inline-flex min-h-10 shrink-0 items-center rounded-xl border border-border px-3 text-[13px] font-semibold hover:border-accent";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setEdit({ id: null, f: { ...EMPTY } }); setErr(""); }} className="min-h-11 rounded-xl bg-accent px-4 text-[14px] font-semibold text-black">+ Add a lead</button>
        <button type="button" onClick={() => { setUpload({ text: "", rows: [] }); setErr(""); }} className="min-h-11 rounded-xl border border-border px-4 text-[14px] font-semibold">⬆ Upload a list</button>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, city, source, notes…" aria-label="Search leads"
          className="min-h-11 min-w-[12rem] flex-1 rounded-xl border border-border bg-card px-3 text-[15px] outline-none focus:border-accent" />
      </div>
      {msg && <p className="text-[13px] text-[#7ddc8f]">{msg}</p>}
      {/* November 17: filter by how hot she is, and online / in person. */}
      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        {([["all", "All"], ...TEMPS.map((t) => [t.v, `${t.icon} ${t.label}`]), ["none", "Not marked"]] as [Temp | "all" | "none", string][]).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setTempF(v)} aria-pressed={tempF === v}
            className={`min-h-9 rounded-full border px-3 ${tempF === v ? "border-accent bg-accent text-black font-semibold" : "border-border text-dim"}`}>
            {label} <span className="opacity-70">{v === "all" ? leads.length : leads.filter((l) => (v === "none" ? !l.temperature : l.temperature === v)).length}</span>
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {([["all", "Online + in person"], ["online", "Online"], ["in_person", "In person"]] as [LeadType | "all", string][]).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setTypeF(v)} aria-pressed={typeF === v}
            className={`min-h-9 rounded-full border px-3 ${typeF === v ? "border-accent text-accent font-semibold" : "border-border text-dim"}`}>{label}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-1 text-[13px] text-dim">
        <input type="checkbox" checked={allPicked} onChange={() => setPicked((p) => { const n = new Set(p); for (const l of shown) { if (allPicked) n.delete(l.id); else n.add(l.id); } return n; })} className="size-4 accent-[var(--accent)]" aria-label="Select all shown" />
        <span>{shown.length} lead{shown.length === 1 ? "" : "s"}{search ? " found" : ""}</span>
      </div>

      {/* November 19 (Michael): Status, First, Last, Phone, Email, Notes, the two contact dates, and Details (type, time
          slot, city, source in a pop-up). Fits a computer screen; the labels stay on top while he scrolls. */}
      <div className="hidden rounded-2xl border border-border bg-card lg:block">
        <table className="w-full table-fixed text-left text-[12.5px]">
          <colgroup>
            <col className="w-8" /><col className="w-[7.5rem]" /><col className="w-[6.5rem]" /><col className="w-[7rem]" /><col className="w-[5.75rem]" /><col className="w-[9rem]" />
            <col /><col className="w-[6.25rem]" /><col className="w-[6.25rem]" /><col className="w-[5rem]" />
          </colgroup>
          <thead className="text-[11px] uppercase tracking-wide text-dim">
            <tr>
              {(() => {
                const th = "sticky top-[calc(env(safe-area-inset-top)+56px)] z-10 border-b border-border bg-card p-2 first:rounded-tl-2xl last:rounded-tr-2xl";
                const sortTh = (by: SortBy, label: string) => (
                  <th key={by} className={th} aria-sort={sort.by === by ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                    <button type="button" onClick={() => sortBy(by)} className={`inline-flex items-center gap-1 uppercase hover:text-accent ${sort.by === by ? "text-accent" : ""}`}>
                      {label}<span aria-hidden="true">{sort.by === by ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
                    </button>
                  </th>
                );
                return (<>
                  <th className={th} />{sortTh("status", "Status")}{sortTh("first", "First")}{sortTh("last", "Last")}
                  <th className={th}>Phone</th><th className={th}>Email</th><th className={th}>Notes</th>
                  <th className={`${th} normal-case`} title="The last day she reached out to you">She reached out</th>
                  <th className={`${th} normal-case`} title="The last day you reached out to her">I reached out</th>
                  <th className={th}>Details</th>
                </>);
              })()}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((l) => (
              <tr key={l.id} className={`align-top ${picked.has(l.id) ? "bg-[#161310]" : ""}`}>
                <td className="p-2"><input type="checkbox" checked={picked.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.first_name} ${l.last_name}`} className="mt-0.5 size-[17px] accent-[var(--accent)]" /></td>
                <td className="p-2"><TempPick compact v={l.temperature ?? ""} onPick={(v) => mark([l.id], { temperature: v })} /></td>
                <td className="truncate p-2"><button type="button" onClick={() => { setEdit({ id: l.id, f: toInput(l) }); setErr(""); }} className="max-w-full truncate font-semibold hover:text-accent" title={l.first_name}>{l.first_name || "—"}</button></td>
                <td className="truncate p-2"><button type="button" onClick={() => { setEdit({ id: l.id, f: toInput(l) }); setErr(""); }} className="max-w-full truncate font-semibold hover:text-accent" title={l.last_name}>{l.last_name || <span className="text-dim">—</span>}</button></td>
                <td className="whitespace-nowrap p-2 pt-[9px] text-[10px]">{fmtPhone(l.phone) || <span className="text-dim">—</span>}</td>
                <td className="truncate p-2 pt-[9px] text-[10px]" title={l.email ?? ""}>{l.email || <span className="text-dim">—</span>}</td>
                <td className="p-2 text-[#cfcfcf]"><span className="line-clamp-3" title={l.notes ?? ""}>{l.notes}</span></td>
                <td className="p-2"><DateCell v={l.last_heard_on ?? null} label="She reached out" onPick={(d) => mark([l.id], { last_heard_on: d })} /></td>
                <td className="p-2"><DateCell v={l.last_reached_on ?? null} label="I reached out" onPick={(d) => mark([l.id], { last_reached_on: d })} /></td>
                <td className="p-2">
                  <button type="button" onClick={() => setDetails(l)} className="min-h-7 rounded-full border border-border px-2.5 text-[11px] font-semibold hover:border-accent hover:text-accent">Details</button>
                  {(l.facebook || l.instagram) && (
                    <span className="mt-1 flex gap-1">
                      {l.facebook && <Link href={`/coach/text?kind=leads&via=messenger&ids=${l.id}`} title={`Messenger: ${l.facebook}`} className="text-[14px]">💬</Link>}
                      {l.instagram && <Link href={`/coach/text?kind=leads&via=instagram&ids=${l.id}`} title={`Instagram: @${l.instagram}`} className="text-[14px]">📸</Link>}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <p className="p-6 text-center text-[14px] text-dim">{leads.length ? "Nobody matches." : "No leads yet. Add one, or upload a list."}</p>}
      </div>
      {/* On a phone: sort with one tap too. */}
      <div className="flex items-center gap-1.5 text-[13px] lg:hidden">
        <span className="text-dim">Sort:</span>
        {([["new", "Newest"], ["status", "Status"], ["first", "First"], ["last", "Last"]] as [SortBy, string][]).map(([by, label]) => (
          <button key={by} type="button" onClick={() => sortBy(by)} aria-pressed={sort.by === by}
            className={`min-h-9 rounded-full border px-3 ${sort.by === by ? "border-accent text-accent font-semibold" : "border-border text-dim"}`}>{label}{sort.by === by && by !== "new" ? (sort.dir === 1 ? " ▲" : " ▼") : ""}</button>
        ))}
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card lg:hidden">
        {shown.map((l) => (
          <li key={l.id} className={`flex items-start gap-3 px-3 py-2.5 ${picked.has(l.id) ? "bg-[#161310]" : ""}`}>
            <input type="checkbox" checked={picked.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.first_name} ${l.last_name}`} className="mt-1 size-[18px] shrink-0 accent-[var(--accent)]" />
            <div className="min-w-0 flex-1 space-y-1">
              <button type="button" onClick={() => { setEdit({ id: l.id, f: toInput(l) }); setErr(""); }} className="block w-full text-left">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-semibold">{`${l.first_name} ${l.last_name}`.trim() || l.email || l.phone}</span>
                  <span className="shrink-0 text-[11px] text-dim">{[l.time_slot, l.city].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="block truncate text-[12px] text-dim">{[fmtPhone(l.phone), l.email].filter(Boolean).join(" · ") || "No phone or email"}</span>
                <span className="block truncate text-[12px] text-dim">{[l.lead_source, l.contact_method].filter(Boolean).join(" · ")}</span>
                {l.notes && <span className="mt-0.5 block line-clamp-2 text-[13px] text-[#cfcfcf]">{l.notes}</span>}
              </button>
              <div className="flex flex-wrap gap-1.5"><TypePick v={l.lead_type ?? ""} onPick={(v) => mark([l.id], { lead_type: v })} /><TempPick v={l.temperature ?? ""} onPick={(v) => mark([l.id], { temperature: v })} /></div>
            </div>
          </li>
        ))}
        {!shown.length && <li className="p-6 text-center text-[14px] text-dim">{leads.length ? "Nobody matches." : "No leads yet. Add one, or upload a list (a CSV from GoHighLevel or a spreadsheet)."}</li>}
      </ul>

      {picked.size > 0 && (
        <div className="fixed inset-x-0 z-30 bottom-[calc(env(safe-area-inset-bottom)+57px)] border-t border-border bg-bg/95 px-4 py-2.5 backdrop-blur">
          <div className="mx-auto max-w-7xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm">{one ? <b>{`${one.first_name} ${one.last_name}`.trim()}</b> : <><b>{picked.size}</b> selected</>}</span>
              <button type="button" onClick={() => { setPicked(new Set()); setSure(false); }} className="min-h-10 rounded-xl px-3 text-sm text-dim">Clear</button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {TEMPS.map((t) => <button key={t.v} type="button" disabled={pending} onClick={() => mark([...picked], { temperature: t.v })} className={act}>{t.icon} {t.label}</button>)}
              {TYPES.map((t) => <button key={t.v} type="button" disabled={pending} onClick={() => mark([...picked], { lead_type: t.v })} className={act}>{t.label}</button>)}
              <Link href={`/coach/text?kind=leads&ids=${[...picked].join(",")}`} className={`${act} border-accent bg-accent text-black`}>📱 Text {one ? one.first_name || "her" : picked.size} from my phone</Link>
              {/* November 20: or on Facebook Messenger (his Facebook) / Instagram (SUFitness), on a phone or a computer. */}
              <Link href={`/coach/text?kind=leads&via=messenger&ids=${[...picked].join(",")}`} className={act}>💬 Messenger</Link>
              <Link href={`/coach/text?kind=leads&via=instagram&ids=${[...picked].join(",")}`} className={act}>📸 Instagram</Link>
              <button type="button" onClick={async () => {
                const list = pickedRows.map((r) => r.email).filter(Boolean).join(", ");
                try { await navigator.clipboard.writeText(list); setMsg(`Copied ${pickedRows.filter((r) => r.email).length} email address${pickedRows.length === 1 ? "" : "es"}.`); } catch { setMsg(list); }
              }} className={act}>Copy email{one ? "" : "s"}</button>
              {sure
                ? <button type="button" disabled={pending} onClick={() => start(async () => { const r = await deleteLeads([...picked]); if (r?.error) setMsg(r.error); else { setMsg(`Deleted ${picked.size}.`); setPicked(new Set()); } setSure(false); })} className={`${act} border-[var(--red)] text-[var(--red)]`}>Yes, delete {picked.size}</button>
                : <button type="button" onClick={() => setSure(true)} className={`${act} text-[var(--red)]`}>Delete</button>}
            </div>
          </div>
        </div>
      )}

      {details && <DetailsBox l={byId.get(details.id) ?? details} onClose={() => setDetails(null)} onSaved={() => { setDetails(null); setMsg("Saved."); }} />}

      {edit && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={edit.id ? "Edit lead" : "Add a lead"}>
          <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveLead(edit.id, edit.f); if (r?.error) setErr(r.error); else { setEdit(null); setMsg(edit.id ? "Saved." : "Lead added."); } }); }}
            className="max-h-[90dvh] w-full max-w-lg space-y-2.5 overflow-y-auto rounded-[20px] border border-border bg-[#121212] p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-xl uppercase">{edit.id ? "Edit lead" : "Add a lead"}</h2>
              <button type="button" onClick={() => setEdit(null)} className="min-h-9 px-2 text-dim" aria-label="Close">✕</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TypePick v={edit.f.lead_type} onPick={(v) => setEdit({ ...edit, f: { ...edit.f, lead_type: v } })} />
              <TempPick v={edit.f.temperature} onPick={(v) => setEdit({ ...edit, f: { ...edit.f, temperature: v } })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FIELDS.map(([k, label, kind]) => (
                <label key={k} className={`flex flex-col gap-1 text-[12px] text-dim ${kind === "area" || k === "email" || k === "lead_source" || k === "contact_method" || k === "facebook" || k === "instagram" ? "col-span-2" : ""}`}>
                  {label}
                  {kind === "area"
                    ? <textarea value={edit.f[k] ?? ""} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, [k]: e.target.value } })} rows={3} className="rounded-xl border border-border bg-card p-2.5 text-[15px] text-text outline-none focus:border-accent" />
                    : <input type={kind} value={edit.f[k] ?? ""} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, [k]: e.target.value } })} autoFocus={k === "first_name"}
                        autoCapitalize={kind === "email" || k === "facebook" || k === "instagram" ? "none" : "words"} className="min-h-11 rounded-xl border border-border bg-card px-3 text-[15px] text-text outline-none focus:border-accent" />}
                </label>
              ))}
            </div>
            {err && <p className="text-sm text-[var(--red)]">{err}</p>}
            <button disabled={pending} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-black disabled:opacity-50">{pending ? "Saving…" : edit.id ? "Save" : "Add lead"}</button>
          </form>
        </div>
      )}

      {upload && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Upload a list">
          <div className="max-h-[90dvh] w-full max-w-lg space-y-3 overflow-y-auto rounded-[20px] border border-border bg-[#121212] p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-xl uppercase">Upload a list</h2>
              <button type="button" onClick={() => setUpload(null)} className="min-h-9 px-2 text-dim" aria-label="Close">✕</button>
            </div>
            <p className="text-[13px] text-dim">A CSV from GoHighLevel or a spreadsheet, with columns like First Name, Last Name, Phone, Email, Time Slot, City, Source, Method of Communication, Notes (and Online/In person, Hot/Warm/Cold/Dead). Or paste the rows below. People already in your leads (same email or phone) are skipped.</p>
            <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-accent text-[14px] font-semibold text-accent">
              Choose a CSV file
              <input type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
            </label>
            <textarea value={upload.text} onChange={(e) => setUpload({ text: e.target.value, rows: parseLeads(e.target.value) })} rows={5} placeholder={"First Name,Last Name,Email,Phone,City\nMaria,Lopez,maria@email.com,5625551234,Long Beach"}
              aria-label="Or paste your list" className="w-full rounded-xl border border-border bg-card p-3 font-mono text-[13px] outline-none focus:border-accent" />
            {upload.rows.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-3 text-[13px]">
                <p className="mb-1 font-semibold">{upload.rows.length} lead{upload.rows.length === 1 ? "" : "s"} found. First few:</p>
                {upload.rows.slice(0, 4).map((r, i) => <p key={i} className="truncate text-dim">{`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "(no name)"} · {r.email || "no email"} · {r.phone || "no phone"}{r.city ? ` · ${r.city}` : ""}</p>)}
              </div>
            )}
            {err && <p className="text-sm text-[var(--red)]">{err}</p>}
            <button type="button" disabled={pending || !upload.rows.length} onClick={() => start(async () => {
              const r = await importLeads(upload.rows);
              if (r?.error) { setErr(r.error); return; }
              setUpload(null); setMsg(`Added ${r.added} lead${r.added === 1 ? "" : "s"}${r.skipped ? ` (${r.skipped} already there, skipped)` : ""}.`);
            })} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-black disabled:opacity-50">{pending ? "Adding…" : `Add ${upload.rows.length || ""} lead${upload.rows.length === 1 ? "" : "s"}`}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** November 17: online or in person, tap to set (tap again to clear). */
function TypePick({ v, onPick }: { v: LeadType; onPick: (v: LeadType) => void }) {
  return (
    <span className="inline-flex overflow-hidden rounded-full border border-border text-[11px]">
      {TYPES.map((t) => (
        <button key={t.v} type="button" onClick={() => onPick(v === t.v ? "" : t.v)} aria-pressed={v === t.v}
          className={`min-h-7 whitespace-nowrap px-2 ${v === t.v ? "bg-accent font-semibold text-black" : "text-dim"}`}>{t.label}</button>
      ))}
    </span>
  );
}
/** November 17: hot, warm, cold or dead, tap to set (tap again to clear). November 19: compact (icons only) in the table. */
function TempPick({ v, onPick, compact = false }: { v: Temp; onPick: (v: Temp) => void; compact?: boolean }) {
  return (
    <span className={`inline-flex ${compact ? "gap-0.5" : "gap-1"}`}>
      {TEMPS.map((t) => (
        <button key={t.v} type="button" onClick={() => onPick(v === t.v ? "" : t.v)} aria-pressed={v === t.v} title={t.label} aria-label={t.label}
          className={`min-h-7 whitespace-nowrap rounded-full border text-[12px] ${compact ? "px-1" : "px-1.5"} ${v === t.v ? `${t.on} font-semibold` : "border-border opacity-50 grayscale"}`}>
          {t.icon}{v === t.v && !compact ? ` ${t.label}` : ""}
        </button>
      ))}
    </span>
  );
}

const dayNice = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.slice(0, 4) === String(new Date().getFullYear()) ? undefined : "2-digit", timeZone: "UTC" });
const todayLA = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

/** November 19: a contact date. Tap it: Today, pick a day, or clear. */
function DateCell({ v, label, onPick }: { v: string | null; label: string; onPick: (d: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const ago = v ? Math.round((Date.parse(todayLA()) - Date.parse(v)) / 86_400_000) : null;
  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setOpen((x) => !x)} aria-label={`${label}: ${v ? dayNice(v) : "not set"}`}
        className={`min-h-7 whitespace-nowrap rounded-md px-1 text-left text-[12px] hover:text-accent ${v ? "" : "text-dim"}`}>
        {v ? <>{dayNice(v)}{ago !== null && <span className="block text-[10px] text-dim">{ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`}</span>}</> : "+ Add"}
      </button>
      {open && (
        <span className="absolute right-0 top-full z-30 mt-1 flex w-48 flex-col gap-1.5 rounded-xl border border-border bg-[#121212] p-2 shadow-xl">
          <span className="text-[11px] text-dim">{label}</span>
          <button type="button" onClick={() => { onPick(todayLA()); setOpen(false); }} className="min-h-9 rounded-lg bg-accent text-[13px] font-semibold text-black">Today</button>
          <input type="date" max={todayLA()} defaultValue={v ?? ""} onChange={(e) => { if (e.target.value) { onPick(e.target.value); setOpen(false); } }}
            className="min-h-9 rounded-lg border border-border bg-bg px-2 text-[13px] [color-scheme:dark]" aria-label={`Pick the day: ${label}`} />
          <span className="flex justify-between">
            {v ? <button type="button" onClick={() => { onPick(null); setOpen(false); }} className="min-h-8 text-[12px] text-[var(--red)]">Clear</button> : <span />}
            <button type="button" onClick={() => setOpen(false)} className="min-h-8 text-[12px] text-dim">Close</button>
          </span>
        </span>
      )}
    </span>
  );
}

/** November 19: her details in a pop-up: online or in person, then time slot, city and source (and how you talk). */
function DetailsBox({ l, onClose, onSaved }: { l: Lead; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<LeadInput>(toInput(l));
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const box = "min-h-11 rounded-xl border border-border bg-card px-3 text-[15px] text-text outline-none focus:border-accent";
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Details" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveLead(l.id, f); if (r?.error) setErr(r.error); else onSaved(); }); }}
        className="w-full max-w-sm space-y-2.5 rounded-[20px] border border-border bg-[#121212] p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-xl uppercase">{`${l.first_name} ${l.last_name}`.trim() || "Details"}</h2>
          <button type="button" onClick={onClose} className="min-h-9 px-2 text-dim" aria-label="Close">✕</button>
        </div>
        <label className="flex flex-col gap-1 text-[12px] text-dim">Type<TypePick v={f.lead_type} onPick={(v) => setF({ ...f, lead_type: v })} /></label>
        <label className="flex flex-col gap-1 text-[12px] text-dim">Time slot<input value={f.time_slot} onChange={(e) => setF({ ...f, time_slot: e.target.value })} className={box} /></label>
        <label className="flex flex-col gap-1 text-[12px] text-dim">City<input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={box} /></label>
        <label className="flex flex-col gap-1 text-[12px] text-dim">Source<input value={f.lead_source} onChange={(e) => setF({ ...f, lead_source: e.target.value })} className={box} /></label>
        <label className="flex flex-col gap-1 text-[12px] text-dim">How you talk (Txt, IG DM…)<input value={f.contact_method} onChange={(e) => setF({ ...f, contact_method: e.target.value })} className={box} /></label>
        <label className="flex flex-col gap-1 text-[12px] text-dim">Facebook (username or profile link)<input value={f.facebook ?? ""} onChange={(e) => setF({ ...f, facebook: e.target.value })} autoCapitalize="none" placeholder="jane.doe" className={box} /></label>
        <label className="flex flex-col gap-1 text-[12px] text-dim">Instagram (username)<input value={f.instagram ?? ""} onChange={(e) => setF({ ...f, instagram: e.target.value })} autoCapitalize="none" placeholder="@janedoe" className={box} /></label>
        {(l.facebook || l.instagram) && (
          <div className="flex gap-2">
            {l.facebook && <Link href={`/coach/text?kind=leads&via=messenger&ids=${l.id}`} className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-border text-[13px] font-semibold">💬 Messenger</Link>}
            {l.instagram && <Link href={`/coach/text?kind=leads&via=instagram&ids=${l.id}`} className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-border text-[13px] font-semibold">📸 Instagram</Link>}
          </div>
        )}
        {err && <p className="text-sm text-[var(--red)]">{err}</p>}
        <button disabled={pending} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-black disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
      </form>
    </div>
  );
}
