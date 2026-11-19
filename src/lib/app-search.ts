import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** November 19 (Sara: "Is there a search bar anywhere?"): one thing she can find from the search box. */
export type SearchHit = { title: string; where: string; href: string; words: string };

/** The app's screens and what's on them, in her words. */
const PAGES: SearchHit[] = [
  { title: "Last night's sleep", where: "Today", href: "/today#sleep", words: "sleep track sleep hours bed tired rest night" },
  { title: "Today's water", where: "Today", href: "/today", words: "water ounces oz gallon drink hydration" },
  { title: "Weight", where: "Today", href: "/today", words: "weigh in weight scale log weight" },
  { title: "Steps", where: "Today", href: "/today", words: "steps walk walking step count" },
  { title: "Today's habits", where: "Today", href: "/today", words: "habits check off daily to do" },
  { title: "Missed a day? Fill it in", where: "Today → Missed a day?", href: "/log", words: "past day yesterday forgot missed log fill in" },
  { title: "Food log", where: "Food", href: "/food", words: "food log meal photo voice calories protein fiber eat breakfast lunch dinner snack" },
  { title: "My foods", where: "Food → My foods", href: "/food", words: "my foods saved favorites re-add again usual" },
  { title: "Food rules", where: "Food", href: "/food", words: "food rules never pork allergies preferences" },
  { title: "Workouts", where: "Workouts", href: "/workouts", words: "workout strength training exercise lift gym program day" },
  { title: "Cardio", where: "Workouts", href: "/workouts", words: "cardio sprints jump rope kettlebell bike" },
  { title: "Lessons", where: "Lessons", href: "/lessons", words: "lessons videos habits homework strong body wednesday strong mind friday sbw smf h&h" },
  { title: "Your circles and medals", where: "Progress → Circles", href: "/progress#circles", words: "circles medals capacity rings fix-it focus" },
  { title: "Progress", where: "Progress", href: "/progress", words: "progress charts results weight trend cps capacity points badges" },
  { title: "Progress photos", where: "Progress → Photos", href: "/progress#photos", words: "photos pictures before after progress pics" },
  { title: "Weekly check-in", where: "Check-in", href: "/checkin", words: "check in check-in weekly questions video" },
  { title: "Chat with Michael", where: "Chat (top right)", href: "/chat", words: "chat message michael question coach text" },
  { title: "Calendar", where: "Calendar (top)", href: "/calendar", words: "calendar schedule workout days group call replay" },
  { title: "Real Talk Tuesday (group call)", where: "Community / Calendar", href: "/community", words: "group call zoom tuesday replay real talk" },
  { title: "Community", where: "Community", href: "/community", words: "community posts group women share" },
  { title: "Cycle tracker", where: "Account → Cycle tracker", href: "/cycle", words: "cycle period menstrual menopause symptoms hormones" },
  { title: "Alerts", where: "Alerts (top)", href: "/notifications", words: "alerts notifications reminders" },
  { title: "Account and notifications", where: "Account (your picture)", href: "/me", words: "account profile name birthday picture photo notifications email settings sign out log out" },
  { title: "How circles work", where: "Progress → Circles", href: "/circles/how", words: "how circles work medals streak 14 days" },
];

export async function loadSearchIndex(supabase: SupabaseClient): Promise<SearchHit[]> {
  const [{ data: circles }, { data: rings }, { data: items }, { data: lessons }] = await Promise.all([
    supabase.from("circles").select("id, slug, name, kind"),
    supabase.from("rings").select("id, circle_id, ring_number, name"),
    supabase.from("ring_items").select("ring_id, title"),
    supabase.from("lessons").select("id, kind, number, title, week_number").not("week_number", "is", null).eq("retired", false),
  ]);
  const C = new Map((circles ?? []).map((c) => [c.id as string, c]));
  const R = new Map((rings ?? []).map((r) => [r.id as string, r]));
  const out: SearchHit[] = [...PAGES];
  for (const c of circles ?? []) out.push({ title: c.name as string, where: c.kind === "growth" ? "Circle" : "Fix-it circle", href: `/circles/${c.slug}`, words: "circle" });
  for (const r of rings ?? []) {
    const c = C.get(r.circle_id as string);
    if (c) out.push({ title: r.name as string, where: `${c.name} · Medal ${r.ring_number}`, href: `/circles/${c.slug}`, words: "medal" });
  }
  for (const i of items ?? []) {
    const r = R.get(i.ring_id as string), c = r && C.get(r.circle_id as string);
    if (r && c) out.push({ title: i.title as string, where: `${c.name} · Medal ${r.ring_number}`, href: `/circles/${c.slug}`, words: "habit" });
  }
  const KIND: Record<string, string> = { hh: "Habits & Homework", sbw: "Strong Body Wednesday", smf: "Strong Mind Friday", other: "Bonus" };
  for (const l of lessons ?? []) out.push({ title: l.title as string, where: `Lessons · ${KIND[l.kind as string] ?? "Lesson"} · Week ${l.week_number}`, href: `/lessons/${l.id}`, words: "lesson video" });
  return out;
}
