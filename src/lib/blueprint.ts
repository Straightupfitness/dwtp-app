import type { Screen } from "./checkin-screens";

/**
 * The Driven Woman Blueprint (November 10): the 19-question assessment she fills in before her onboarding call,
 * one question per screen with Michael's 7X-xx video. Matches "DWTP Video Scripts - Batch 1" and the answer fields
 * agreed November 9. Answers live in assessments.answers.
 */
const note = (id: string, label = "Anything you want to add? (optional)") => ({ id, label, kind: "note" as const, optional: true });

export const BLUEPRINT: Screen[] = [
  { key: "about", code: "7X-01", title: "Tell me about yourself", fields: [{ id: "about", label: "What you do for work, who's at home, and what working out has looked like for you over the years", kind: "open", video: true }] },
  { key: "numbers", code: "7X-02", title: "Your starting line", fields: [
    { id: "dob", label: "Date of birth", kind: "date" },
    { id: "height_ft", label: "Height (feet)", kind: "number", unit: "ft", min: 4, max: 7 },
    { id: "height_in", label: "Height (inches)", kind: "number", unit: "in", min: 0, max: 11 },
    { id: "weight_now", label: "What you weigh right now", kind: "number", unit: "lbs", min: 70, max: 600 },
    { id: "weight_goal", label: "The weight you'd love to get to", kind: "number", unit: "lbs", min: 70, max: 600 },
  ] },
  { key: "dream", code: "7X-03", title: "Six months from now, with no limits", fields: [{ id: "dream", label: "What would your life look like? How would you feel when you wake up?", kind: "open", video: true }] },
  { key: "got_in_way", code: "7X-04", title: "What got in the way every other time?", fields: [{ id: "got_in_way", label: "Be honest. This is what I need to know so it doesn't happen again.", kind: "open", video: true }] },
  { key: "sleep_times", code: "7X-05", title: "Your bedtime and wake time", fields: [
    { id: "bed_weekday", label: "Bedtime on weekdays", kind: "time" },
    { id: "wake_weekday", label: "Wake time on weekdays", kind: "time" },
    { id: "bed_weekend", label: "Bedtime on weekends", kind: "time" },
    { id: "wake_weekend", label: "Wake time on weekends", kind: "time" },
  ] },
  { key: "sleep", code: "7X-06", title: "How's your sleep?", fields: [
    { id: "sleep", label: "Sleep", kind: "scale", help: "1 = awful, 10 = the best sleep of your life" },
    { id: "wakeups_3am", label: "Nights a week you wake up around 3 AM and can't fall back asleep", kind: "choice", options: ["0", "1–2", "3–4", "5–7"] },
    note("sleep_note"),
  ] },
  { key: "energy", code: "7X-07", title: "How's your energy?", fields: [
    { id: "energy", label: "Energy", kind: "scale", help: "1 = running on empty, 10 = full of energy" },
    { id: "afternoon_crash", label: "Do you hit a wall in the afternoon?", kind: "choice", options: ["Never", "Sometimes", "Most days"] },
    note("energy_note"),
  ] },
  { key: "stress", code: "7X-08", title: "How stressed are you most days?", fields: [
    { id: "stress", label: "Stress", kind: "scale", help: "1 = totally calm, 10 = through the roof" },
    { id: "stress_cause", label: "What's causing most of it right now?", kind: "open" },
  ] },
  { key: "caffeine", code: "7X-09", title: "Let's talk caffeine", fields: [
    { id: "caffeine_drinks", label: "Coffee, energy drinks or pre-workout a day", kind: "choice", options: ["0", "1", "2", "3", "4+"] },
    { id: "caffeine_last", label: "Your last one is usually", kind: "choice", options: ["Before 10 AM", "10 AM–noon", "Noon–2 PM", "2–4 PM", "After 4 PM", "No caffeine"] },
    note("caffeine_what", "What do you drink? (optional)"),
  ] },
  { key: "alcohol", code: "7X-10", title: "Alcohol", fields: [
    { id: "alcohol", label: "Drinks a week (wine counts)", kind: "choice", options: ["0", "1–3", "4–7", "8–14", "15+"] },
    note("alcohol_note"),
  ] },
  { key: "meals", code: "7X-11", title: "Your meals on a normal day", fields: [
    { id: "meals", label: "Meals a day", kind: "choice", options: ["1", "2", "3", "4+"] },
    { id: "snacks", label: "Snacks a day", kind: "choice", options: ["0", "1", "2", "3+"] },
    { id: "breakfast", label: "Breakfast", kind: "choice", options: ["Yes, I eat breakfast", "Coffee until lunch", "No breakfast"] },
    note("meals_note"),
  ] },
  { key: "tracking", code: "7X-12", title: "Have you tracked your food before?", fields: [
    { id: "tracked", label: "Tracking", kind: "choice", options: ["Never", "Tried it and quit", "I do it regularly"] },
    note("tracked_note"),
  ] },
  { key: "fav_meals", code: "7X-13", title: "Your three favorite meals", fields: [
    { id: "fav_meal_1", label: "Favorite meal #1", kind: "short" },
    { id: "fav_meal_2", label: "Favorite meal #2", kind: "short", optional: true },
    { id: "fav_meal_3", label: "Favorite meal #3", kind: "short", optional: true },
  ] },
  { key: "groceries", code: "7X-14", title: "Groceries and cooking", fields: [
    { id: "shop", label: "Where you usually shop (tap all that fit)", kind: "multi", options: ["Costco", "Walmart", "Target", "Trader Joe's", "Whole Foods", "Sprouts", "Kroger / Ralphs / Safeway", "Aldi", "A local market", "Online / delivery", "Somewhere else"] },
    { id: "cook", label: "Who does the cooking at your house?", kind: "choice", options: ["Me", "My partner", "We share it", "Someone else"] },
    note("groceries_note"),
  ] },
  { key: "supplements", code: "7X-15", title: "Supplements", fields: [{ id: "supplements", label: "List what you take right now: vitamins, protein powder, anything. Nothing? Just say none.", kind: "open" }] },
  { key: "pain", code: "7X-16", title: "Any pain or injuries right now?", fields: [
    { id: "pain", label: "Tap all that fit", kind: "multi", options: ["Knees", "Shoulders", "Feet or heels", "Hips", "Low back", "Neck", "Wrists or elbows", "None"] },
    note("pain_note", "Tell me more (optional)"),
  ] },
  { key: "menopause", code: "7X-17", title: "Perimenopause or menopause", fields: [
    { id: "menopause", label: "Any of these? (tap all that fit)", kind: "multi", options: ["Hot flashes", "Night sweats", "Irregular cycle", "Mood swings", "Brain fog", "Trouble sleeping", "None", "Not sure"] },
    note("menopause_note", "Tell me more (optional)"),
  ] },
  { key: "travel", code: "7X-18", title: "How often do you travel?", fields: [
    { id: "travel", label: "Travel", kind: "choice", options: ["Never", "About once a month", "Every week"] },
    note("travel_note"),
  ] },
  { key: "last", code: "7X-19", title: "Last one", fields: [{ id: "anything_else", label: "Anything else you want me to know? Or tell me a fun fact about you.", kind: "open", optional: true, video: true }] },
];

/** Every Blueprint field's label, for Michael's view of her answers. */
export function blueprintLabels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of BLUEPRINT) for (const f of s.fields) out[f.id] = f.kind === "open" ? s.title : f.label;
  return out;
}

/** The three questions under ONB-01 that unlock the Blueprint. The first option is the right one (shuffled on screen). */
export const UNLOCK = [
  { q: "What do we fix first?", options: ["Your sleep", "Your diet", "Your workouts"] },
  { q: "When is your weekly check-in due?", options: ["Monday at noon", "Friday night", "Whenever I can"] },
  { q: "Where do you message Michael with a question?", options: ["Chat in the app", "Email", "Instagram"] },
];

/** New clients (added November 10 or later, or still "onboarding") fill in the Blueprint; clients who started before don't. */
export const BLUEPRINT_SINCE = "2026-11-10";
export const needsBlueprint = (p: { role?: string | null; status?: string | null; created_at?: string | null }, submitted: boolean) =>
  p.role === "client" && !submitted && (p.status === "onboarding" || (!!p.created_at && p.created_at.slice(0, 10) >= BLUEPRINT_SINCE));
