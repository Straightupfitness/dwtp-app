"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { deleteLeads, importLeads, saveLead, type LeadInput } from "./actions";

export type Lead = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; city: string | null; goals: string | null; notes: string | null; source: string; created_at: string };

const EMPTY: LeadInput = { first_name: "", last_name: "", email: "", phone: "", city: "", goals: "", notes: "" };
const FIELDS: [keyof LeadInput, string, string][] = [
  ["first_name", "First name", "text"], ["last_name", "Last name", "text"], ["email", "Email", "email"], ["phone", "Phone", "tel"],
  ["city", "City she lives in", "text"], ["goals", "Her goals", "area"], ["notes", "Extra info", "area"],
];
const nice = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
    return { first_name: first, last_name: last, email: get(col.email), phone: get(col.phone), city: get(col.city), goals: get(col.goals), notes: get(col.notes) };
  });
}

/**
 * November 15: Michael's Leads tab, like his Clients list. Add, edit, upload a list, tick several and text them from
 * his own phone (same fill-ins as for clients), or copy their emails.
 */
export default function LeadsView({ leads }: { leads: Lead[] }) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<{ id: string | null; f: LeadInput } | null>(null);
  const [upload, setUpload] = useState<{ text: string; rows: Partial<LeadInput>[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => !q || [l.first_name, l.last_name, l.email, l.phone, l.city, l.goals, l.notes].some((x) => (x ?? "").toLowerCase().includes(q)));
  }, [leads, search]);
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
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, city, goals…" aria-label="Search leads"
          className="min-h-11 min-w-[12rem] flex-1 rounded-xl border border-border bg-card px-3 text-[15px] outline-none focus:border-accent" />
      </div>
      {msg && <p className="text-[13px] text-[#7ddc8f]">{msg}</p>}

      <div className="flex items-center gap-2 px-1 text-[13px] text-dim">
        <input type="checkbox" checked={allPicked} onChange={() => setPicked((p) => { const n = new Set(p); for (const l of shown) { if (allPicked) n.delete(l.id); else n.add(l.id); } return n; })} className="size-4 accent-[var(--accent)]" aria-label="Select all shown" />
        <span>{shown.length} lead{shown.length === 1 ? "" : "s"}{search ? " found" : ""}</span>
      </div>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {shown.map((l) => (
          <li key={l.id} className={`flex items-start gap-3 px-3 py-2.5 ${picked.has(l.id) ? "bg-[#161310]" : ""}`}>
            <input type="checkbox" checked={picked.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.first_name} ${l.last_name}`} className="mt-1 size-[18px] shrink-0 accent-[var(--accent)]" />
            <button type="button" onClick={() => { setEdit({ id: l.id, f: { first_name: l.first_name, last_name: l.last_name, email: l.email ?? "", phone: l.phone ?? "", city: l.city ?? "", goals: l.goals ?? "", notes: l.notes ?? "" } }); setErr(""); }} className="min-w-0 flex-1 text-left">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px] font-semibold">{`${l.first_name} ${l.last_name}`.trim() || l.email || l.phone}</span>
                <span className="shrink-0 text-[11px] text-dim">{l.city ? `${l.city} · ` : ""}{nice(l.created_at)}</span>
              </span>
              <span className="block truncate text-[12px] text-dim">{[fmtPhone(l.phone), l.email].filter(Boolean).join(" · ") || "No phone or email"}</span>
              {(l.goals || l.notes) && <span className="mt-0.5 block line-clamp-2 text-[13px] text-[#cfcfcf]">{l.goals}{l.goals && l.notes ? " · " : ""}<span className="text-dim">{l.notes}</span></span>}
            </button>
          </li>
        ))}
        {!shown.length && <li className="p-6 text-center text-[14px] text-dim">{leads.length ? "Nobody matches." : "No leads yet. Add one, or upload a list (a CSV from GoHighLevel or a spreadsheet)."}</li>}
      </ul>

      {picked.size > 0 && (
        <div className="fixed inset-x-0 z-30 bottom-[calc(env(safe-area-inset-bottom)+57px)] border-t border-border bg-bg/95 px-4 py-2.5 backdrop-blur">
          <div className="mx-auto max-w-5xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm">{one ? <b>{`${one.first_name} ${one.last_name}`.trim()}</b> : <><b>{picked.size}</b> selected</>}</span>
              <button type="button" onClick={() => { setPicked(new Set()); setSure(false); }} className="min-h-10 rounded-xl px-3 text-sm text-dim">Clear</button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              <Link href={`/coach/text?kind=leads&ids=${[...picked].join(",")}`} className={`${act} border-accent bg-accent text-black`}>📱 Text {one ? one.first_name || "her" : picked.size} from my phone</Link>
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

      {edit && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={edit.id ? "Edit lead" : "Add a lead"}>
          <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveLead(edit.id, edit.f); if (r?.error) setErr(r.error); else { setEdit(null); setMsg(edit.id ? "Saved." : "Lead added."); } }); }}
            className="max-h-[90dvh] w-full max-w-lg space-y-2.5 overflow-y-auto rounded-[20px] border border-border bg-[#121212] p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-xl uppercase">{edit.id ? "Edit lead" : "Add a lead"}</h2>
              <button type="button" onClick={() => setEdit(null)} className="min-h-9 px-2 text-dim" aria-label="Close">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FIELDS.map(([k, label, kind]) => (
                <label key={k} className={`flex flex-col gap-1 text-[12px] text-dim ${kind === "area" || k === "email" || k === "city" ? "col-span-2" : ""}`}>
                  {label}
                  {kind === "area"
                    ? <textarea value={edit.f[k]} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, [k]: e.target.value } })} rows={3} className="rounded-xl border border-border bg-card p-2.5 text-[15px] text-text outline-none focus:border-accent" />
                    : <input type={kind} value={edit.f[k]} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, [k]: e.target.value } })} autoFocus={k === "first_name"}
                        autoCapitalize={kind === "email" ? "none" : "words"} className="min-h-11 rounded-xl border border-border bg-card px-3 text-[15px] text-text outline-none focus:border-accent" />}
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
            <p className="text-[13px] text-dim">A CSV from GoHighLevel or a spreadsheet, with columns like First Name, Last Name, Email, Phone, City, Goals, Notes. Or paste the rows below. People already in your leads (same email or phone) are skipped.</p>
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
