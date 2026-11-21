import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * November 17 (Michael): the menstrual cycle tracker. Works out where she is in her cycle from the periods she logged
 * (her own average length once she has a few), and suggests how hard to lift today. She always decides.
 */
export type Mode = "period" | "symptoms" | null;
export type Phase = "period" | "follicular" | "ovulation" | "luteal" | "pre-period" | "late";
export type Intensity = "heavy" | "normal" | "lighter";
export type Period = { start_date: string; end_date: string | null };
export type DayLog = { energy: number | null; symptoms: string[]; intensity: Intensity | null };
export type Cycle = { day: number; length: number; periodLength: number; phase: Phase; nextIn: number; learned: boolean };

export const SYMPTOMS: [string, string][] = [
  ["cramps", "Cramps"], ["bloating", "Bloating"], ["headache", "Headache"], ["poor-sleep", "Slept badly"],
  ["low-mood", "Low mood"], ["hot-flashes", "Hot flashes"],
  // November 20 (Michael, for Heather): the menopause symptoms from the Blueprint question, so she can tap exactly what she had.
  ["night-sweats", "Night sweats"], ["brain-fog", "Brain fog"], ["mood-swings", "Mood swings"],
  ["sore", "Very sore"], ["great", "Feeling great"],
];
export const PHASE_INFO: Record<Phase, { label: string; color: string; note: string }> = {
  period: { label: "Period", color: "#ef4444", note: "Energy can be lower. A lighter day is fine; moving still helps cramps." },
  follicular: { label: "Follicular", color: "#22c55e", note: "Energy is usually rising. A great week to push your weights." },
  ovulation: { label: "Ovulation", color: "#f5a623", note: "Often your strongest days. Go for it, and warm up well." },
  luteal: { label: "Luteal", color: "#a78bfa", note: "Steady training. Eat enough protein; you may feel warmer and hungrier." },
  "pre-period": { label: "Before your period", color: "#f472b6", note: "Energy and sleep can dip. Lighter weights or fewer reps are fine." },
  late: { label: "Period expected", color: "#f472b6", note: "Your period is due. Log it when it starts." },
};

const days = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);

export function cycleOf(periods: Period[], today: string): Cycle | null {
  const ps = [...periods].filter((p) => p.start_date <= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (!ps.length) return null;
  const gaps = ps.slice(1).map((p, i) => days(ps[i].start_date, p.start_date)).filter((g) => g >= 18 && g <= 50).slice(-6);
  const length = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 28;
  const lens = ps.filter((p) => p.end_date).map((p) => days(p.start_date, p.end_date!) + 1).filter((x) => x >= 1 && x <= 10).slice(-6);
  const periodLength = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 5;
  const last = ps[ps.length - 1];
  const day = days(last.start_date, today) + 1;
  const ov = length - 14;
  const ended = last.end_date && last.end_date < today;
  const phase: Phase = day > length ? "late"
    : day <= periodLength && !ended ? "period"
    : day < ov - 1 ? "follicular"
    : day <= ov + 1 ? "ovulation"
    : day > length - 5 ? "pre-period" : "luteal";
  return { day, length, periodLength, phase, nextIn: Math.max(0, length - day + 1), learned: gaps.length >= 2 };
}

/** What the app suggests today. Low energy or a rough symptom → lighter; strong part of the cycle and good energy → heavy. */
export function suggest(mode: Mode, c: Cycle | null, log: DayLog | null): { pick: Intensity; why: string } {
  const e = log?.energy ?? null, s = log?.symptoms ?? [];
  const rough = s.some((x) => ["cramps", "headache", "poor-sleep", "sore", "hot-flashes", "night-sweats"].includes(x));
  if (e !== null && e <= 2) return { pick: "lighter", why: "Your energy is low today." };
  if (rough && !(e !== null && e >= 4)) return { pick: "lighter", why: "You noted symptoms today." };
  if (s.includes("great") || (e !== null && e >= 4)) {
    if (mode === "period" && c && (c.phase === "period" || c.phase === "pre-period")) return { pick: "normal", why: "You feel good. Go by feel." };
    return { pick: "heavy", why: "You feel strong today." };
  }
  if (mode === "period" && c) {
    if (c.phase === "follicular" || c.phase === "ovulation") return { pick: "heavy", why: `${PHASE_INFO[c.phase].label}: often a strong time.` };
    if (c.phase === "period" || c.phase === "pre-period") return { pick: "lighter", why: `${PHASE_INFO[c.phase].label}: a lighter day is fine.` };
  }
  return { pick: "normal", why: "Train as planned." };
}

export const INTENSITY_INFO: Record<Intensity, { label: string; icon: string; tip: string }> = {
  heavy: { label: "Go heavy", icon: "🔥", tip: "Try a little more weight than last time, or one more rep, if your form stays solid." },
  normal: { label: "Normal", icon: "💪", tip: "Train as planned." },
  lighter: { label: "Lighter today", icon: "🌙", tip: "Use about 10–20% less weight than last time and stop 2 reps before it gets hard." },
};

/** Everything the app needs for her cycle today (tolerates the tables not being there yet). */
export async function loadCycle(supabase: SupabaseClient, clientId: string, today: string) {
  const { data: p, error } = await supabase.from("profiles").select("cycle_tracking").eq("id", clientId).maybeSingle();
  if (error) return null;
  const mode = ((p?.cycle_tracking as string | null) ?? null) as Mode;
  if (!mode) return { mode, cycle: null, log: null, periods: [] as Period[] };
  const [{ data: periods }, { data: log }] = await Promise.all([
    supabase.from("cycle_periods").select("start_date, end_date").eq("client_id", clientId).order("start_date", { ascending: false }).limit(24),
    supabase.from("cycle_days").select("energy, symptoms, intensity").eq("client_id", clientId).eq("day", today).maybeSingle(),
  ]);
  const ps = (periods ?? []) as Period[];
  return { mode, cycle: mode === "period" ? cycleOf(ps, today) : null, log: (log ?? null) as DayLog | null, periods: ps };
}
