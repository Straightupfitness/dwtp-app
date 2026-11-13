import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { blueprintDone } from "@/lib/blueprint";
import { sendHeadStart } from "@/lib/head-start";

export const maxDuration = 60;

/**
 * November 13: send the Week 1 head start to clients who finished their Blueprint before it was automatic.
 * Coach only; only clients whose Blueprint is done; never twice (dedupe in notify).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") return NextResponse.json({ error: "Coach only" }, { status: 403 });
  const { clientIds } = (await req.json()) as { clientIds: string[] };
  if (!Array.isArray(clientIds) || clientIds.length > 100) return NextResponse.json({ error: "Bad list" }, { status: 400 });
  const db = adminClient();
  const { data: rows } = await db.from("assessments").select("client_id, submitted_at").in("client_id", clientIds);
  const done = (rows ?? []).filter((r) => blueprintDone(r.submitted_at as string | null)).map((r) => r.client_id as string);
  const { data: before } = await db.from("notification_log").select("user_id").eq("key", "hh-ready:1").in("user_id", done);
  const already = new Set((before ?? []).map((r) => r.user_id as string));
  const sent: string[] = [], failed: string[] = [];
  for (const id of done.filter((d) => !already.has(d))) {
    try { await sendHeadStart(db, id); sent.push(id); } catch (e) { console.error("head start", id, e); failed.push(id); }
  }
  return NextResponse.json({ sent, alreadyHad: [...already], notDone: clientIds.filter((c) => !done.includes(c)), failed });
}
