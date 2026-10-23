import { createClient } from "@/lib/supabase/server";
import ChatThread from "@/components/chat/ChatThread";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <section className="space-y-3">
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">Your coach</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Michael</h1>
        <p className="text-xs text-dim">Questions, wins, a photo of your plate. Michael usually replies within a day.</p>
      </header>
      <ChatThread clientId={user!.id} viewerId={user!.id} otherName="Michael" />
    </section>
  );
}
