import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, full_name, avatar_path").eq("id", user.id).single() : { data: null };
  const coach = me?.role === "coach";
  // Unread messages: hers from Michael, or (for Michael) every client's to him.
  let q = supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", user?.id ?? "");
  if (!coach) q = q.eq("client_id", user?.id ?? "");
  const { count } = user ? await q : { count: 0 };
  return (
    <>
      <TopBar coach={coach} unread={count ?? 0} name={me?.full_name ?? null} avatarPath={me?.avatar_path ?? null} />
      <main className="mx-auto max-w-md px-4 pb-28 pt-4">{children}</main>
      <BottomNav coach={coach} />
    </>
  );
}
