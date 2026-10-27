"use client";
import Link from "next/link";
import MondayPicker from "./MondayPicker";
import { useActionState } from "react";
import { addClient } from "./actions";

const input = "mt-1 block w-full rounded-lg border border-border bg-bg px-3 py-2 text-base text-text outline-none focus:border-accent";

/** The next Monday (or today, if it's Monday), as YYYY-MM-DD. */
function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

export default function AddClientPage() {
  const [state, action, pending] = useActionState(addClient, null);
  return (
    <section className="space-y-4">
      <Link href="/coach" className="inline-flex min-h-11 items-center text-sm text-dim">← Clients</Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl uppercase">Add a client</h1>
      <p className="text-sm text-dim">She signs in with an email link, so there&apos;s no password to set.</p>
      <form action={action} className="space-y-3">
        <label className="block text-sm text-dim">Name<input name="full_name" required className={input} /></label>
        <label className="block text-sm text-dim">Email<input name="email" type="email" required autoCapitalize="none" className={input} /></label>
        <div className="grid grid-cols-2 gap-3">
          <MondayPicker defaultValue={nextMonday()} className={input} />
          <label className="text-sm text-dim">Plan
            <select name="plan" defaultValue="26_weeks" className={input}>
              <option value="26_weeks">26 weeks</option><option value="52_weeks">Full year</option><option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="text-sm text-dim">Start weight (lbs)<input name="start_weight_lbs" type="number" step="any" inputMode="decimal" className={input} /></label>
          <label className="text-sm text-dim">Goal weight (lbs)<input name="goal_weight_lbs" type="number" step="any" inputMode="decimal" className={input} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="send_welcome" defaultChecked className="size-4 accent-[var(--accent)]" />
          Email her a one-tap link to open the app (good for 14 days)
        </label>
        <button disabled={pending} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-black disabled:opacity-50">{pending ? "Adding…" : "Add client"}</button>
        {state?.error && <p className="text-sm text-[var(--red)]">{state.error}</p>}
      </form>
    </section>
  );
}
