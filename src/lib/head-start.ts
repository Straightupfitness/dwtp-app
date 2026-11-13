import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "./notify";
import { lessonEmail } from "./lesson-email";

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.straightupfitness.com").replace(/\/$/, "");

/**
 * November 12: her head start once her Driven Woman Blueprint is in. Week 1 Habits & Homework is already open
 * (lib/lessons); this tells her, by push / Alerts and by email. Sends once per client (dedupe "hh-ready:1").
 * Returns the lesson id, or null if there's no Week 1 H&H.
 */
export async function sendHeadStart(db: SupabaseClient, clientId: string): Promise<string | null> {
  const [{ data: hh1 }, { data: p }] = await Promise.all([
    db.from("lessons").select("id, title").eq("kind", "hh").eq("week_number", 1).eq("retired", false).maybeSingle(),
    db.from("profiles").select("full_name, program_start").eq("id", clientId).single(),
  ]);
  if (!hh1) return null;
  const first = ((p?.full_name as string | null) ?? "").trim().split(/\s+/)[0] || null;
  const startDay = (p?.program_start as string | null) ?? null;
  const onDay = startDay ? new Date(startDay + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }) : null;
  const email = lessonEmail({
    kind: "hh", week: 1, title: (hh1.title as string) || "Your first habits", firstName: first,
    body: `You did it! Your Driven Woman Blueprint is in, so I'm giving you a head start: your Week 1 Habits & Homework is open in the app right now.\n\nWatch the video and read through your first habits, so you're ready to hit the ground running${onDay ? ` on ${onDay}` : " when your program starts"}.\n\nI'm going through your answers now and building your plan around them. Can't wait to get started with you!`,
    button: { label: "Open my Week 1 Habits & Homework", url: `${APP_URL()}/lessons/${hh1.id}` },
  });
  await notify(clientId, {
    title: "Your Week 1 Habits & Homework is ready", body: "Your Blueprint is in, so here's your head start. Tap to open it.",
    url: `/lessons/${hh1.id}`, email, dedupeKey: "hh-ready:1",
  });
  return hh1.id as string;
}
