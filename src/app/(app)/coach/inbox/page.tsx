import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/names";
import LiveRefresh from "@/components/LiveRefresh";

export default async function Inbox() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: msgs }, { data: clients }] = await Promise.all([
    supabase.from("messages").select("client_id, sender_id, body, attachment_path, created_at, read_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("profiles").select("id, full_name, email").or("role.eq.client,program_start.not.is.null").order("full_name"),
  ]);
  const threads = new Map<string, { last: NonNullable<typeof msgs>[number]; unread: number }>();
  for (const m of msgs ?? []) {
    const t = threads.get(m.client_id) ?? { last: m, unread: 0 };
    if (m.sender_id !== user!.id && !m.read_at) t.unread++;
    threads.set(m.client_id, t);
  }
  const rows = (clients ?? []).filter((c) => c.id !== user!.id || threads.has(c.id))
    .map((c) => ({ c, t: threads.get(c.id) }))
    .sort((a, b) => (b.t?.unread ?? 0) - (a.t?.unread ?? 0) || (b.t?.last.created_at ?? "").localeCompare(a.t?.last.created_at ?? ""));

  return (
    <section className="space-y-4">
      <LiveRefresh tables={["messages"]} />
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Coach</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Inbox</h1>
      </header>
      <ul className="space-y-2">
        {rows.map(({ c, t }) => (
          <li key={c.id}>
            <Link href={`/coach/inbox/${c.id}`} className={`flex items-center gap-3 rounded-xl border p-3 ${t?.unread ? "border-accent bg-accent/10" : "border-border bg-card"}`}>
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
