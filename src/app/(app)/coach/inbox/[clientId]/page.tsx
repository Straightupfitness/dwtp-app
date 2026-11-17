import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ChatThread from "@/components/chat/ChatThread";
import Avatar from "@/components/Avatar";

export default async function CoachThread({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: p }, { data: msgs }, { data: clients }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, avatar_path").eq("id", clientId).single(),
    supabase.from("messages").select("client_id").order("created_at", { ascending: false }).limit(1000),
    supabase.from("profiles").select("id, full_name").or("role.eq.client,program_start.not.is.null").neq("status", "cancelled").order("full_name"),
  ]);
  // November 17 (Michael): ‹ and › go to the previous / next chat, in Inbox order (latest message first, then
  // everyone else A to Z), without going back to the Inbox.
  const order: string[] = [];
  for (const m of msgs ?? []) if (!order.includes(m.client_id as string)) order.push(m.client_id as string);
  for (const c of clients ?? []) if (!order.includes(c.id as string)) order.push(c.id as string);
  const list = order.filter((id) => id !== user!.id);
  const at = list.indexOf(clientId);
  const prev = at > 0 ? list[at - 1] : null, next = at >= 0 && at < list.length - 1 ? list[at + 1] : null;
  const arrow = "grid size-10 shrink-0 place-items-center rounded-full border border-border text-[18px] hover:border-accent hover:text-accent";
  const first = p?.full_name?.split(" ")[0] ?? "her";
  return (
    <section className="mx-auto max-w-3xl space-y-3">
      {/* November 10: her name, Inbox and Client page stay pinned at the top while you scroll the chat. */}
      <header className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-20 -mx-4 flex items-center gap-3 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur md:mx-0 md:rounded-b-xl md:px-3">
        <Link href="/coach/inbox" className="inline-flex min-h-11 shrink-0 items-center text-sm text-dim hover:text-text">← Inbox</Link>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {prev ? <Link href={`/coach/inbox/${prev}`} aria-label="Previous chat" className={arrow}>‹</Link> : <span className="size-10 shrink-0" />}
          <Avatar name={p?.full_name} path={p?.avatar_path} size={36} />
          <h1 className="min-w-0 truncate font-[family-name:var(--font-display)] text-xl uppercase">{p?.full_name ?? p?.email}</h1>
          {next ? <Link href={`/coach/inbox/${next}`} aria-label="Next chat" className={arrow}>›</Link> : <span className="size-10 shrink-0" />}
        </span>
        <Link href={`/coach/clients/${clientId}`} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-accent">Client page ›</Link>
      </header>
      <ChatThread clientId={clientId} viewerId={user!.id} otherName={first} />
    </section>
  );
}
