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
    <section className="space-y-3">
      <Link href="/coach/inbox" className="inline-flex min-h-11 items-center text-sm text-dim">← Inbox</Link>
      <header className="flex items-end justify-between">
        <span className="flex items-center gap-3"><Avatar name={p?.full_name} path={p?.avatar_path} size={44} />
          <h1 className="font-[family-name:var(--font-display)] text-2xl uppercase">{p?.full_name ?? p?.email}</h1></span>
        <Link href={`/coach/clients/${clientId}`} className="text-sm text-accent">Client page</Link>
      </header>
      <ChatThread clientId={clientId} viewerId={user!.id} otherName={first} />
    </section>
  );
}
