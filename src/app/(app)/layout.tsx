import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import JourneyBar from "@/components/JourneyBar";
import { createClient } from "@/lib/supabase/server";
import { journey, todayIn } from "@/lib/program";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, full_name, avatar_path, program_start, timezone").eq("id", user.id).single() : { data: null };
  const coach = me?.role === "coach";
  // Unread messages: hers from Michael, or (for Michael) every client's to him.
  let q = supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", user?.id ?? "");
  if (!coach) q = q.eq("client_id", user?.id ?? "");
  const { count } = user ? await q : { count: 0 };
  const tz = me?.timezone ?? "America/Los_Angeles";
  const j = me && !coach ? journey(me.program_start, todayIn(tz)) : null;
  const date = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(new Date());
  return (
    <>
      <TopBar coach={coach} unread={count ?? 0} name={me?.full_name ?? null} avatarPath={me?.avatar_path ?? null} />
      {j && <JourneyBar {...j} date={date} />}
      <main className="mx-auto max-w-md px-4 pb-28 pt-4">{children}</main>
      <BottomNav coach={coach} />
    </>
  );
}
