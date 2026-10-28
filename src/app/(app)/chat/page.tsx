import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import ChatThread from "@/components/chat/ChatThread";
import BackButton from "@/components/BackButton";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: coach } = await supabase.from("member_names").select("full_name, avatar_path").eq("role", "coach").limit(1).maybeSingle();
  return (
    <section className="space-y-3">
      <BackButton fallback="/today" />
      <header className="flex items-center gap-3 border-b border-border pb-3">
        <Avatar name={coach?.full_name ?? "Michael"} path={coach?.avatar_path} size={44} coach />
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold uppercase">Michael</h1>
          <p className="text-xs text-[#a8a8a8]">Your coach · usually replies within a day</p>
        </div>
      </header>
      <ChatThread clientId={user!.id} viewerId={user!.id} otherName="Michael" />
    </section>
  );
}
