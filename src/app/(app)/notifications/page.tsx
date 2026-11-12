import Link from "next/link";
import { createClient, viewAsInfo } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import MarkRead from "./MarkRead";

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
  const { data, error } = await supabase.from("notifications").select("id, title, body, url, read_at, created_at")
    .eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50);
  const rows = data ?? [];
  const tz = profile?.timezone ?? "America/Los_Angeles";
  const when = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const unread = rows.some((r) => !r.read_at);
  return (
    <section className="space-y-3.5">
      <BackButton fallback="/today" />
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">What the app told you</p>
        <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Alerts</h1>
      </header>
      {!viewing && <MarkRead any={unread} />}
      {rows.length ? (
        <ul className="divide-y divide-border rounded-[18px] border border-border bg-card">
          {rows.map((n) => (
            <li key={n.id}>
              <Link href={n.url || "/today"} className="flex gap-3 px-3.5 py-3">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-accent"}`} aria-label={n.read_at ? undefined : "New"} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug">{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-[14px] leading-snug text-[#cfcfcf]">{n.body}</span>}
                  <span className="mt-1 block text-[12px] text-dim">{when(n.created_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-[#2f2f2f] p-6 text-center text-[14px] text-dim">
          {error ? "Your alerts will show up here." : "No alerts yet. When Michael replies to your check-in, sends a message or a new lesson opens, you'll see it here."}
        </p>
      )}
      <p className="text-center text-[12px] text-dim">Turn notifications on or off in <Link href="/me" className="text-accent underline">Account</Link>.</p>
    </section>
  );
}
