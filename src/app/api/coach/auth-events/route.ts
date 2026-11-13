import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** November 13: the sign-in log (renewals and lost sessions), newest first. Coach only. ?who=part-of-email */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") return NextResponse.json({ error: "Coach only" }, { status: 403 });
  const who = new URL(req.url).searchParams.get("who");
  let q = supabase.from("auth_events").select("at, kind, who, path, code, message, agent").order("at", { ascending: false }).limit(200);
  if (who) q = q.ilike("who", `%${who.replace(/[%_]/g, "")}%`);
  const { data, error } = await q;
  return NextResponse.json(error ? { error: error.message } : data);
}
