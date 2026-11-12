import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import TimezoneSync from "@/components/TimezoneSync";
import AppBadge from "@/components/AppBadge";
import { InstallCatcher } from "@/components/InstallHelp";
import { after } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { recordSeen } from "@/lib/seen";
import { createClient, viewAsInfo } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, full_name, avatar_path, program_start, timezone").eq("id", user.id).single() : { data: null };
  const coach = me?.role === "coach";
  const viewing = user && !coach ? await viewAsInfo() : null;
  // Last seen (for Michael's "not in the app for 48 hours"): at most one write every 15 minutes.
  if (user && !coach && !viewing) after(async () => {
    const uid = user.id;
    const now = new Date(), cutoff = new Date(now.getTime() - 15 * 60_000).toISOString();
    const db = adminClient();
    const { data: bumped, error } = await db.from("profiles").update({ last_seen_at: now.toISOString() }).eq("id", uid).or(`last_seen_at.is.null,last_seen_at.lt.${cutoff}`).select("id");
    // November 1: one row per day she's in the app, for Michael's 7-day ✓/✗ strip.
    if (bumped?.length || error) await recordSeen(db, uid, me?.timezone ?? null);
  });
  // Unread messages: hers from Michael, or (for Michael) every client's to him.
  let q = supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", user?.id ?? "");
  if (!coach) q = q.eq("client_id", user?.id ?? "");
  const { count } = user ? await q : { count: 0 };
  // November 11: notifications she hasn't opened (the number on the app icon). Missing table before 0040: 0.
  const { count: alerts } = user ? await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null) : { count: 0 };
  return (
    <>
      {viewing && (
        <div className="relative z-30 flex items-center gap-2 bg-[#7c3aed] px-3 py-1.5 text-[13px] text-white">
          <span className="min-w-0 flex-1 truncate">👀 You&apos;re seeing <b>{viewing.name ?? "her"}</b>&apos;s app · look only, nothing you tap is saved</span>
          <a href={`/coach/view-as/exit?to=/coach/clients/${viewing.id}`} className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[#5b21b6]">Exit</a>
        </div>
      )}
      <TopBar coach={coach} unread={count ?? 0} alerts={alerts ?? 0} name={me?.full_name ?? null} avatarPath={me?.avatar_path ?? null} />
      {/* November 1: Michael's screens use the full width on a computer. */}
      <main className={`mx-auto px-4 pb-28 pt-4 ${coach ? "max-w-md md:max-w-[1400px] md:px-8" : "max-w-md"}`}>{children}</main>
      <BottomNav coach={coach} />
      {user && !viewing && <TimezoneSync saved={me?.timezone ?? null} />}
      <InstallCatcher />
      {user && !viewing && <AppBadge count={alerts ?? 0} />}
    </>
  );
}
