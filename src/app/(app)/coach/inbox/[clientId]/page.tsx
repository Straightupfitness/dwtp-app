import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ChatThread from "@/components/chat/ChatThread";
import Avatar from "@/components/Avatar";

export default async function CoachThread({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("full_name, email, avatar_path").eq("id", clientId).single();
  const first = p?.full_name?.split(" ")[0] ?? "her";
  return (
    <section className="mx-auto max-w-3xl space-y-3">
      {/* November 10: her name, Inbox and Client page stay pinned at the top while you scroll the chat. */}
      <header className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-20 -mx-4 flex items-center gap-3 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur md:mx-0 md:rounded-b-xl md:px-3">
        <Link href="/coach/inbox" className="inline-flex min-h-11 shrink-0 items-center text-sm text-dim hover:text-text">← Inbox</Link>
        <span className="flex min-w-0 flex-1 items-center gap-2.5"><Avatar name={p?.full_name} path={p?.avatar_path} size={36} />
          <h1 className="truncate font-[family-name:var(--font-display)] text-xl uppercase">{p?.full_name ?? p?.email}</h1></span>
        <Link href={`/coach/clients/${clientId}`} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-accent">Client page ›</Link>
      </header>
      <ChatThread clientId={clientId} viewerId={user!.id} otherName={first} />
    </section>
  );
}
