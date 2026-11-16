import Link from "next/link";
import { createClient, viewAsInfo } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import AlertsList from "./AlertsList";

export const dynamic = "force-dynamic"; // November 15: always the latest, never a saved copy

const display = "font-[family-name:var(--font-display)] uppercase";

/**
 * November 11 (Imelda: "4 notifications on the app icon, but what are they?"): every notification the app has sent
 * her, newest first. Tap one to go where it points. Opening this page clears the number on the icon.
 */
export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, viewing] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", user!.id).single(),
    viewAsInfo(),
  ]);
  const { data } = await supabase.from("notifications").select("id, title, body, url, read_at, created_at")
    .eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50);
  const rows = data ?? [];
  const tz = profile?.timezone ?? "America/Los_Angeles";
  return (
    <section className="space-y-3.5">
      <BackButton fallback="/today" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">What the app told you</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Alerts</h1>
      </header>
      <AlertsList initial={rows as Parameters<typeof AlertsList>[0]["initial"]} tz={tz} viewing={!!viewing} />
      <p className="text-center text-[12px] text-dim">Turn notifications on or off in <Link href="/me" className="text-accent underline">Account</Link>.</p>
    </section>
  );
}
