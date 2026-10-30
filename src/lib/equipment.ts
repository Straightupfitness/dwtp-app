/**
 * What gear a workout needs (October 30: "freestyle" workouts by the equipment she has), read from its exercise
 * names: "DB" = dumbbells, "BB" = barbell, "KB" = kettlebell, "Banded" = bands, "Cable"/"Pulley"/"Machine" = gym…
 */
export const GEAR: { key: string; label: string; test: RegExp }[] = [
  { key: "dumbbells", label: "Dumbbells", test: /\bdbs?\b|dumbbell/i },
  { key: "barbell", label: "Barbell & rack", test: /\bbb\b|barbell|landmine|trap ?bar|hex ?bar|\bsquat rack\b|^(?:incline |decline |flat )?bench press|back squat|front squat|rack pull|1 rep max (bench|squat|deadlift)/i },
  { key: "kettlebell", label: "Kettlebell", test: /\bkbs?\b|kettle ?bell/i },
  { key: "bands", label: "Resistance bands", test: /\bband(ed|s)?\b|slingshot/i },
  { key: "bench", label: "Bench", test: /\bbench\b|\bincline\b|\bdecline\b|step[- ]?ups?\b/i },
  { key: "pullup", label: "Pull-up bar, rings or dip bars", test: /pull ?-?ups?|chin ?-?ups?|hanging|\brings?\b|toes to bar|muscle ?ups?|\bdead hang|\bdips?\b|front levers?/i },
  { key: "gym", label: "Cables & machines (gym)", test: /cable|pulley|machine|pull ?downs?|lat pull|leg press|leg extension|leg curl|hamstring curl|smith|\bsled\b|\bghd\b|hack squat|pec deck|seated row|assisted|belt squat|reverse hyper|\bt-?bar\b/i },
  { key: "rope", label: "Jump rope", test: /jump ?rope|skipping|double unders/i },
  { key: "battle", label: "Battle ropes", test: /battl\w* ropes?|rope slams|grapple throws/i },
  { key: "bike", label: "Stationary bike", test: /\bbike\b|cycling|assault|air ?dyne|echo bike/i },
];
export const GEAR_LABEL = Object.fromEntries(GEAR.map((g) => [g.key, g.label]));

/** Exercise names that aren't exercises (overview videos, rest, mobility intros) don't count. */
const SKIP = /^rest\b|overview|your questions|meal plan|recipe|warm[- ]?up video/i;

/** The gear a list of exercise names needs. Nothing = bodyweight only. */
export function gearFor(names: string[], workoutName = "") {
  const need = new Set<string>();
  for (const n of names) {
    if (SKIP.test(n)) continue;
    for (const g of GEAR) {
      if (g.key === "gym" && /\bband(ed|s)?\b/i.test(n)) continue; // "Banded Lat Pulldown" is a band, not a machine
      if (g.test.test(n)) need.add(g.key);
    }
  }
  if (/\bkb cardio|kettle ?bell cardio/i.test(workoutName)) need.add("kettlebell");
  if (/barbell cardio|\bbb cardio/i.test(workoutName)) need.add("barbell");
  if (/rope cardio/i.test(workoutName)) need.add("battle");
  if (/bike cardio|cardio on a bike/i.test(workoutName)) need.add("bike");
  return [...need];
}
