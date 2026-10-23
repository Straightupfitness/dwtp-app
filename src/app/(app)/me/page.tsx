import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { programWeek, todayIn } from "@/lib/program";
import { setEmailNotifications, signOut, updateName } from "./actions";
import NotificationSettings from "@/components/NotificationSettings";

export default async function MePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: p }, { data: cps }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, program_start, timezone, plan, email_notifications").eq("id", user!.id).single(),
    supabase.from("cp_totals").select("total").eq("client_id", user!.id).maybeSingle(),
  ]);
  const week = programWeek(p?.program_start ?? null, todayIn(p?.timezone ?? "America/Los_Angeles"));
  return (
    <section className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-accent">{week ? `Week ${week}` : "Starting soon"}{p?.plan === "52_weeks" ? " · Full year" : ""}</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">{p?.full_name || "Me"}</h1>
        <p className="text-sm text-dim">{p?.email} · {cps?.total ?? 0} CPs all time</p>
      </header>
      <form action={updateName} className="flex items-end gap-2">
        <label className="flex-1 text-sm text-dim">Your name (the community sees your first name and last initial)
          <input name="full_name" defaultValue={p?.full_name ?? ""} className="mt-1 block w-full rounded-lg border border-border bg-bg px-3 py-2 text-base text-text outline-none focus:border-accent" />
        </label>
        <button className="min-h-11 rounded-lg border border-border px-4">Save</button>
      </form>
      <div className="space-y-2">
        <h2 className="text-sm uppercase tracking-widest text-dim">Notifications</h2>
        <NotificationSettings />
        <form action={setEmailNotifications.bind(null, !(p?.email_notifications ?? true))} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <span className="text-sm">Email: {p?.email_notifications ?? true ? "on" : "off"}<span className="block text-xs text-dim">Replies and check-in reminders. Messages only when push is off.</span></span>
          <button className="min-h-11 rounded-lg border border-border px-3 text-sm">{p?.email_notifications ?? true ? "Turn off" : "Turn on"}</button>
        </form>
      </div>
      <div className="space-y-2">
        <Link href="/checkin" className="block rounded-xl border border-border bg-card p-3">Check-ins and Michael&apos;s replies</Link>
        <Link href="/chat" className="block rounded-xl border border-border bg-card p-3">Message Michael</Link>
      </div>
      <form action={signOut}><button className="min-h-11 text-sm text-dim underline">Sign out</button></form>
    </section>
  );
}
