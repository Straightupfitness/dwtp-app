import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientBrief } from "@/lib/ai/client-brief";

export const maxDuration = 60;

/** November 13: the "last 48 hours" bullets for one client (coach only). Saved for the follow-up queue when a topic is given. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") return NextResponse.json({ error: "Coach only" }, { status: 403 });
  const { clientId, topic, hours } = (await req.json()) as { clientId: string; topic?: string; hours?: number };
  try {
    const brief = await clientBrief(supabase, clientId, { topic: topic ?? "general", hours: hours === 168 ? 168 : 48 });
    if (topic) await supabase.from("coach_followups").upsert({ client_id: clientId, topic, brief, brief_at: brief.at }, { onConflict: "client_id,topic" });
    return NextResponse.json(brief);
  } catch (e) {
    console.error("brief failed", e);
    return NextResponse.json({ error: `The AI couldn't do this one: ${String((e as Error).message).slice(0, 160)}` }, { status: 502 });
  }
}
