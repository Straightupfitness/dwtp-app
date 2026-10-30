import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import { after } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, full_name, avatar_path, program_start, timezone").eq("id", user.id).single() : { data: null };
  const coach = me?.role === "coach";
  // Last seen (for Michael's "not in the app for 48 hours"): at most one write every 15 minutes.
  if (user && !coach) after(async () => {
    const uid = user.id;
    const now = new Date(), cutoff = new Date(now.getTime() - 15 * 60_000).toISOString();
    await adminClient().from("profiles").update({ last_seen_at: now.toISOString() }).eq("id", uid).or(`last_seen_at.is.null,last_seen_at.lt.${cutoff}`);
  });
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
