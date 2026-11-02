import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/names";
import LiveRefresh from "@/components/LiveRefresh";
import Avatar from "@/components/Avatar";
import BackButton from "@/components/BackButton";
import InboxSearch from "./InboxSearch";
import BirthdaySettings from "./BirthdaySettings";
import { adminClient } from "@/lib/supabase/admin";
import { birthdaySettings } from "@/lib/birthdays";
import { todayIn } from "@/lib/program";

export default async function Inbox() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: msgs }, { data: clients }] = await Promise.all([
    supabase.from("messages").select("client_id, sender_id, body, attachment_path, created_at, read_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("profiles").select("id, full_name, email, avatar_path").or("role.eq.client,program_start.not.is.null").order("full_name"),
  ]);
  const threads = new Map<string, { last: NonNullable<typeof msgs>[number]; unread: number }>();
  for (const m of msgs ?? []) {
    const t = threads.get(m.client_id) ?? { last: m, unread: 0 };
    if (m.sender_id !== user!.id && !m.read_at) t.unread++;
    threads.set(m.client_id, t);
  }
  // Birthday messages (November 2).
  let bday = { on: true, message: "", upcoming: [] as { id: string; name: string; when: string; days: number }[], missing: 0 };
  try {
    const db = adminClient();
    const s = await birthdaySettings(db);
    const { data: bs, error } = await db.from("profiles").select("id, full_name, email, birthday, status").eq("role", "client").neq("status", "cancelled");
    const today = todayIn("America/Los_Angeles"), y = Number(today.slice(0, 4));
    const next = (b: string) => { let d = `${y}-${b.slice(5)}`; if (d < today) d = `${y + 1}-${b.slice(5)}`; return d; };
    const list = error ? [] : (bs ?? []);
    bday = {
      on: s.on, message: s.message, missing: list.filter((c) => !c.birthday).length,
      upcoming: list.filter((c) => c.birthday).map((c) => { const d = next(c.birthday as string); return { id: c.id, name: c.full_name || c.email || "Client", when: new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), days: Math.round((Date.parse(d) - Date.parse(today)) / 86_400_000) }; })
        .filter((u) => u.days <= 60).sort((a, b) => a.days - b.days),
    };
  } catch { /* no service key locally */ }
  const rows = (clients ?? []).filter((c) => c.id !== user!.id || threads.has(c.id))
    .map((c) => ({ c, t: threads.get(c.id) }))
    .sort((a, b) => (b.t?.unread ?? 0) - (a.t?.unread ?? 0) || (b.t?.last.created_at ?? "").localeCompare(a.t?.last.created_at ?? ""));

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <BackButton fallback="/coach" />
      <LiveRefresh tables={["messages"]} />
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Coach</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Inbox</h1>
      </header>
      <BirthdaySettings {...bday} />
      <InboxSearch clients={(clients ?? []).filter((c) => c.id !== user!.id).map((c) => ({ id: c.id, name: c.full_name || c.email || "Client", email: c.email, avatar: c.avatar_path }))} />
      <ul className="space-y-2">
        {rows.map(({ c, t }) => (
          <li key={c.id}>
            <Link href={`/coach/inbox/${c.id}`} className={`flex items-center gap-3 rounded-xl border p-3 ${t?.unread ? "border-accent bg-accent/10" : "border-border bg-card"}`}>
              <Avatar name={c.full_name || c.email} path={c.avatar_path} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.full_name || c.email}</p>
                <p className="truncate text-sm text-dim">{t ? `${t.last.sender_id === user!.id ? "You: " : ""}${t.last.body ?? "Photo"}` : "No messages yet"}</p>
              </div>
              <div className="shrink-0 text-right">
                {t && <p className="text-xs text-dim">{timeAgo(t.last.created_at)}</p>}
                {!!t?.unread && <span className="inline-grid min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-black">{t.unread}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
