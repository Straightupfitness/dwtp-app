"use client";
import { useRouter } from "next/navigation";

/** "Pick any workout": every workout in her program, by phase, in one drop-down (October 30). */
export default function WorkoutPicker({ groups }: { groups: { label: string; workouts: { id: number; name: string }[] }[] }) {
  const router = useRouter();
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-semibold">Pick any workout from your program</span>
      <select defaultValue="" onChange={(e) => e.target.value && router.push(`/workouts/${e.target.value}`)}
        className="min-h-12 w-full rounded-[14px] border border-border bg-card px-3 text-[15px] outline-none focus:border-accent">
        <option value="" disabled>Choose a workout…</option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.workouts.map((w) => <option key={`${g.label}:${w.id}`} value={w.id}>{w.name}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
