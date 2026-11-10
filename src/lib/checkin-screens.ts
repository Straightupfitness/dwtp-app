/**
 * The VideoAsk-style check-in (November 10): one screen per question, each with Michael's video (CHK-xx) on top
 * and its answer fields underneath. Codes match the scripts doc ("DWTP Video Scripts - Batch 1").
 *
 *   Every week   CHK-02 sleep · 03 energy · 04 stress · 05 hunger · 06 habits · 07 win · 08 help · 09 anything else
 *   Week 1       CHK-10 why now · 11 habit checklist
 *   4th weeks    CHK-12 wins · 13 obstacle (4, 8, 16, 20, 24, 28, 32, 40, 44, 48)
 *   Week 4       CHK-14 sleep checkpoint
 *   8, 16, 24    CHK-15 maintenance week · 16 energy and workouts
 *   12, 36       CHK-17 results so far
 *   12/26/36/52  CHK-18 advice · 19 permission to share
 *   13           CHK-20 confidence · 21 second half
 *   24           CHK-22 next six months · 23 after Week 26 (not for full-year clients)
 *   26           CHK-24 results · 25 next three circles
 *   52           CHK-26 one year
 *   Bad week     CHK-28 (right after the welcome, only when she ticks "bad week")
 * CHK-01 is the welcome screen with the Start button. CHK-27 was never filmed.
 */
export type FieldKind = "scale" | "choice" | "multi" | "note" | "open" | "circles" | "date" | "number" | "time" | "short";
export type Field = {
  id: string; label: string; kind: FieldKind;
  options?: string[]; optional?: boolean; help?: string; placeholder?: string;
  unit?: string; min?: number; max?: number; video?: boolean; // video: suggest a video answer (open fields)
};
export type Screen = { key: string; code: string | null; title: string; fields: Field[]; habits?: boolean };

export const GOOD_HABITS = [
  "I eat protein with every meal", "I get into a squat hold for two minutes every day", "I stop all caffeine 10 hours before bed",
  "I sleep in a pitch black room, or wear an eye mask", "I stretch my calves every day", "I go for a 10-minute walk every day",
  "I know exactly how many calories I'm eating", "I drink a gallon of water every day", "I read one book a month",
  "When I wake up, I practice an attitude of gratitude", "I don't compare myself with others", "I eat something before I lift weights",
];
export const BAD_HABITS = [
  "More than 20% of my calories come from processed food", "I let my surroundings decide what I eat", "I drink more than 300 mg of caffeine a day",
  "I'm always rushing in the morning", "I eat super bad on the weekends", "I sometimes eat meals with no protein",
  "I drink more than two alcoholic drinks a week", "I eat unnecessary sweets", "I mindlessly scroll social media when I have things to do",
  "I don't know how many calories I'm really eating",
];

const FOUR_WEEK = [4, 8, 16, 20, 24, 28, 32, 40, 44, 48];
const DIET_BREAK = [8, 16, 24];

const scale = (id: string, label: string, help: string, note: string): Field[] => [
  { id, label, kind: "scale", help },
  { id: `${id}_note`, label: note, kind: "note", optional: true },
];

export function screensFor(week: number, opts: { onFullYear?: boolean } = {}): Screen[] {
  const s: Screen[] = [
    { key: "sleep", code: "CHK-02", title: "How was your sleep this week?", fields: scale("sleep", "Sleep this week", "1 = awful, 10 = the best sleep of your life", "Anything about your sleep? (optional)") },
    { key: "energy", code: "CHK-03", title: "How was your energy this week?", fields: scale("energy", "Energy this week", "Think about your afternoons especially", "Anything about your energy? (optional)") },
    { key: "stress", code: "CHK-04", title: "How stressed were you this week?", fields: scale("stress", "Stress this week", "10 = ready to throw your phone across the room", "What's causing it? (optional)") },
    { key: "hunger", code: "CHK-05", title: "How hungry were you this week?", fields: scale("hunger", "Hunger this week", "1 = barely hungry, 10 = starving all the time", "Anything about your hunger or food? (optional)") },
    { key: "habits", code: "CHK-06", title: "This week's new habits", fields: [], habits: true },
  ];

  if (week === 1) s.push(
    { key: "why_now", code: "CHK-10", title: "What made you finally decide to start, right now?", fields: [{ id: "why_now", label: "Why now?", kind: "open" }] },
    { key: "habit_checklist", code: "CHK-11", title: "Your habits right now", fields: [
      { id: "good_habits", label: "Tap the good habits you already have", kind: "multi", options: GOOD_HABITS, optional: true },
      { id: "bad_habits", label: "Tap the ones you want to get rid of", kind: "multi", options: BAD_HABITS, optional: true },
    ] },
  );
  if (FOUR_WEEK.includes(week)) s.push(
    { key: "wins_4wk", code: "CHK-12", title: "Your biggest wins from the last four weeks", fields: [{ id: "wins_4wk", label: "On the scale and off it: sleep, energy, clothes, mood", kind: "open" }] },
    { key: "obstacle_4wk", code: "CHK-13", title: "Your biggest obstacle from the last four weeks", fields: [{ id: "obstacle_4wk", label: "What got in the way?", kind: "open" }] },
  );
  if (week === 4) s.push({ key: "sleep_checkpoint", code: "CHK-14", title: "Your 30-day sleep checkpoint", fields: [
    { id: "sleep_vs_before", label: "Compared to before you started, your sleep is:", kind: "choice", options: ["Much better", "A bit better", "The same", "Worse"] },
    { id: "wakeups_3am", label: "How many nights this week did you wake up at 3 AM?", kind: "choice", options: ["0", "1–2", "3–4", "5+"] },
    { id: "mornings_now", label: "What feels different about your mornings and afternoons now?", kind: "open" },
  ] });
  if (DIET_BREAK.includes(week)) s.push(
    { key: "maintenance", code: "CHK-15", title: "How did your diet break week feel?", fields: [
      { id: "maintenance_feel", label: "Eating at maintenance felt:", kind: "choice", options: ["Easier", "About the same", "Harder"] },
      { id: "maintenance_note", label: "Tell me more (optional)", kind: "note", optional: true },
    ] },
    { key: "energy_workouts", code: "CHK-16", title: "Any change in your energy or workouts?", fields: [
      { id: "energy_workouts", label: "This week I felt:", kind: "choice", options: ["Stronger", "More tired", "No difference"] },
      { id: "energy_workouts_note", label: "Tell me more (optional)", kind: "note", optional: true },
    ] },
  );
  if (week === 12 || week === 36) s.push({ key: "results", code: "CHK-17", title: "Your results so far", fields: [{ id: "results", label: "On the scale, and off it: sleep, energy, clothes, bloodwork, mood", kind: "open" }] });
  if (week === 26) s.push({ key: "results", code: "CHK-24", title: "Your 26-week results", fields: [{ id: "results", label: "Where were you when you started, and where are you now?", kind: "open" }] });
  if (week === 52) s.push({ key: "one_year", code: "CHK-26", title: "One full year", fields: [{ id: "one_year", label: "What's the biggest change in your life since day one?", kind: "open" }] });
  if ([12, 26, 36, 52].includes(week)) s.push(
    { key: "advice", code: "CHK-18", title: "What would you tell a woman who's on the fence?", fields: [{ id: "advice", label: "A video is perfect here, like you're talking right to her", kind: "open" }] },
    { key: "share", code: "CHK-19", title: "Can I share your story?", fields: [{ id: "share", label: "Any answer is totally fine", kind: "choice", options: ["Yes, with my name", "Yes, without my name or face", "Not at all"] }] },
  );
  if (week === 26) s.push({ key: "next_circles", code: "CHK-25", title: "Pick your next three circles", fields: [{ id: "next_circles", label: "Choose the three that excite you most", kind: "circles" }] });
  if (week === 13) s.push(
    { key: "confidence", code: "CHK-20", title: "How confident are you?", fields: scale("confidence", "Keeping it going on your own after Week 26", "1 = not at all, 10 = totally", "Tell me more (optional)") },
    { key: "second_half", code: "CHK-21", title: "Your second half", fields: [{ id: "second_half", label: "What would make the next 13 weeks your best ones yet?", kind: "open" }] },
  );
  if (week === 24) {
    s.push({ key: "next_6_months", code: "CHK-22", title: "Your next six months", fields: [{ id: "next_6_months", label: "Paint me the picture", kind: "open" }] });
    if (!opts.onFullYear) s.push({ key: "after_26", code: "CHK-23", title: "After Week 26, which feels right?", fields: [
      { id: "after_26", label: "I'll reach out either way", kind: "choice", options: ["I want to keep going with Michael", "I'd like to talk about it", "I'm ready to go on my own"] },
      { id: "after_26_note", label: "Anything you want me to know? (optional)", kind: "note", optional: true },
    ] });
  }

  s.push(
    { key: "win", code: "CHK-07", title: "Your biggest win this week", fields: [{ id: "win", label: "Big or small, it all counts", kind: "open" }] },
    { key: "help", code: "CHK-08", title: "One thing you want help with", fields: [{ id: "help", label: "Or want to do better next week. This is what I'll focus on.", kind: "open" }] },
    { key: "else", code: "CHK-09", title: "Anything else on your mind?", fields: [{ id: "else", label: "A question, something you're not sure about. Ask me anything.", kind: "open", optional: true }] },
  );
  return s;
}

/** The bad-week screen, shown right after the welcome when she ticks "This was a bad week". */
export const BAD_WEEK_SCREEN: Screen = {
  key: "bad_week", code: "CHK-28", title: "Tell me about your week",
  fields: [{ id: "bad_week_story", label: "What happened, and what would help you get back on track next week?", kind: "open", optional: true }],
};

/** Every field's label, for Michael's review screen and the AI reply draft. */
export function screenLabels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const w of [1, 4, 8, 12, 13, 24, 26, 52]) for (const sc of screensFor(w)) for (const f of sc.fields) out[f.id] ??= f.kind === "open" ? sc.title : f.label;
  for (const f of BAD_WEEK_SCREEN.fields) out[f.id] = BAD_WEEK_SCREEN.title;
  return out;
}
