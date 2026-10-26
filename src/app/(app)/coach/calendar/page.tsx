import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/program";
import { CallRow, LinksForm } from "./Forms";

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

/** Michael's calendar settings: the Zoom link, the Trainerize link, and each Real Talk Tuesday (topic, replay, or no call). */
export default async function CoachCalendar() {
  const supabase = await createClient();
  const today = todayIn("America/Los_Angeles");
  const dow = new Date(today + "T12:00:00Z").getUTCDay();
  const thisTue = addDays(today, 2 - dow); // this week's Tuesday (weeks run Mon–Sun)
  const tuesdays = Array.from({ length: 13 }, (_, i) => addDays(thisTue, (i - 6) * 7)).reverse();
  const [{ data: settings }, { data: calls }] = await Promise.all([
    supabase.from("program_settings").select("key, value"),
    supabase.from("calls").select("call_date, title, replay_url, cancelled").gte("call_date", tuesdays[tuesdays.length - 1]).lte("call_date", tuesdays[0]),
  ]);
  const s = (k: string) => settings?.find((x) => x.key === k)?.value ?? "";
  const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <section className="space-y-4">
      <Link href="/coach" className="inline-flex min-h-11 items-center text-sm text-dim">← Clients</Link>
      <header>
        <p className="text-[11px] uppercase tracking-[0.15em] text-accent">What every client sees</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl uppercase">Calendar</h1>
        <p className="mt-1 text-sm text-dim">Real Talk Tuesday shows on every client&apos;s calendar at 4:30 PM Pacific with your Zoom link. After the call, paste the replay link and it replaces the Join button.</p>
      </header>
      <LinksForm zoom={s("rtt_zoom_url")} trainerize={s("trainerize_url")} />
      <h2 className="pt-1 text-[11px] uppercase tracking-[0.15em] text-accent">Real Talk Tuesdays</h2>
      <div className="space-y-2">
        {tuesdays.map((d) => {
          const c = calls?.find((x) => x.call_date === d);
          return <CallRow key={d} date={d} label={`${fmt(d)}${d === thisTue ? " · this week" : ""}`} title={c?.title ?? ""} replay={c?.replay_url ?? ""}
            cancelled={!!c?.cancelled} past={d < today} />;
        })}
      </div>
    </section>
  );
}
