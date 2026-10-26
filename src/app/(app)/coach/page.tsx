import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { currentWindow, windowFor } from "@/lib/checkin";
import { programWeek, todayIn } from "@/lib/program";
import Avatar from "@/components/Avatar";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

type Status = { label: string; tone: "act" | "ok" | "warn" | "dim"; href?: string };

export default async function CoachHome() {
  const supabase = await createClient();
  const { data: clients } = await supabase.from("profiles")
    .select("id, full_name, email, program_start, status, timezone, avatar_path")
    .or("role.eq.client,program_start.not.is.null").order("full_name");
  const ids = (clients ?? []).map((c) => c.id);
  const [{ data: checkins }, { data: weights }, { data: cps }] = await Promise.all([
    ids.length ? supabase.from("checkins").select("id, client_id, week_number, flags, submitted_at, checkin_replies(sent_at)")
      .in("client_id", ids).order("week_number", { ascending: false }) : { data: [] },
    ids.length ? supabase.from("weight_logs").select("client_id, log_date").in("client_id", ids)
      .gte("log_date", daysAgo(30)).order("log_date", { ascending: false }) : { data: [] },
    ids.length ? supabase.from("cp_totals").select("client_id, this_week").in("client_id", ids) : { data: [] },
  ]);

  const rows = (clients ?? []).map((c) => {
    const today = todayIn(c.timezone ?? "America/Los_Angeles");
    const week = programWeek(c.program_start, today);
    const mine = (checkins ?? []).filter((k) => k.client_id === c.id);
    const lastWeight = (weights ?? []).find((w) => w.client_id === c.id)?.log_date ?? null;
    const { open } = currentWindow(c.program_start);
    // The check-in that matters now: the open one, or last week's if it has closed.
    const relevant = open?.week ?? (week > 1 ? week - 1 : null);
    const ci = relevant ? mine.find((k) => k.week_number === relevant) : null;
    const replied = ci && (Array.isArray(ci.checkin_replies) ? ci.checkin_replies[0]?.sent_at : (ci.checkin_replies as { sent_at?: string } | null)?.sent_at);
    let status: Status;
    if (!c.program_start) status = { label: "Not started", tone: "dim" };
    else if (ci && !replied) status = { label: `Week ${ci.week_number}: needs reply`, tone: "act", href: `/coach/checkins/${ci.id}` };
    else if (ci) status = { label: `Week ${ci.week_number}: replied`, tone: "ok", href: `/coach/checkins/${ci.id}` };
    else if (open) status = { label: `Week ${open.week}: not in yet`, tone: "dim" };
    else if (relevant && new Date() >= windowFor(c.program_start, relevant).closes) status = { label: `Week ${relevant}: missed`, tone: "warn" };
    else status = { label: "No check-in yet", tone: "dim" };
    const daysSinceWeight = lastWeight ? Math.round((Date.parse(today) - Date.parse(lastWeight)) / 86_400_000) : null;
    return {
      c, week, status, lastWeight, daysSinceWeight, flags: (ci?.flags as string[]) ?? [],
      cps: (cps ?? []).find((x) => x.client_id === c.id)?.this_week ?? 0,
    };
  }).sort((a, b) => ({ act: 0, warn: 1, dim: 2, ok: 3 }[a.status.tone] - { act: 0, warn: 1, dim: 2, ok: 3 }[b.status.tone]));

  const tone = { act: "border-accent text-accent", ok: "border-[var(--green)] text-[var(--green)]", warn: "border-[var(--red)] text-[var(--red)]", dim: "border-border text-dim" };
  const toReply = rows.filter((r) => r.status.tone === "act").length;
  return (
    <section className="space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Coach</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Clients</h1>
        <p className="text-sm text-dim">{toReply ? `${toReply} check-in${toReply > 1 ? "s" : ""} to reply to` : "All caught up"} · {rows.length} clients</p>
      </header>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/coach/activity" className="flex min-h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-black">Today&apos;s activity</Link>
        <Link href="/coach/clients/new" className="flex min-h-11 items-center justify-center rounded-xl border border-accent text-sm font-semibold text-accent">+ Add a client</Link>
      </div>
      <ul className="space-y-2">
        {rows.map(({ c, week, status, lastWeight, daysSinceWeight, flags, cps }) => (
          <li key={c.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/coach/clients/${c.id}`} className="flex min-w-0 items-center gap-3">
                <Avatar name={c.full_name || c.email} path={c.avatar_path} size={40} />
                <span className="min-w-0">
                <p className="truncate font-semibold">{c.full_name || c.email}</p>
                <p className="text-xs text-dim">{week ? `Week ${week}` : "Not started"} · {cps} CPs this week · {lastWeight
                  ? `weighed in ${daysSinceWeight === 0 ? "today" : `${daysSinceWeight}d ago`}` : "no weigh-ins"}</p>
                </span>
              </Link>
              {status.href
                ? <Link href={status.href} className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${tone[status.tone]}`}>{status.label}</Link>
                : <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${tone[status.tone]}`}>{status.label}</span>}
            </div>
            {(flags.length > 0 || (daysSinceWeight !== null && daysSinceWeight >= 4) || (!lastWeight && week > 0)) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {flags.map((f) => <span key={f} className="rounded bg-[#2a1a10] px-2 py-0.5 text-xs text-gold">{f}</span>)}
                {((daysSinceWeight ?? 99) >= 4 && week > 0) && <span className="rounded bg-[#2a1a10] px-2 py-0.5 text-xs text-gold">No weigh-in for {lastWeight ? `${daysSinceWeight} days` : "30+ days"}</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
