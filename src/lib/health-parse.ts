/** Reading the numbers her iPhone Shortcut sends, and which habits a number can check off. */
/** "8,214", "8214 steps", "7.2 hr" → 8214 / 7.2. */
export function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const m = String(v ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Habits her phone can check off by itself, read from the habit's wording. */
export function threshold(title: string): { kind: "steps" | "sleep"; min: number } | null {
  const t = title.trim();
  let m = t.match(/^(?:Walk )?([\d,]+) steps(?: a day| daily)?$/i);
  if (m) return { kind: "steps", min: Number(m[1].replace(/,/g, "")) };
  m = t.match(/^Sleep ([\d.]+)\+? (?:hours|hrs)$/i) ?? t.match(/^([\d.]+)\+? hrs sleep$/i);
  if (m) return { kind: "sleep", min: Number(m[1]) * 60 };
  return null;
}

