import { NextResponse } from "next/server";
import { createClient, viewAsInfo } from "@/lib/supabase/server";

/** November 15: her (or Michael's) alerts, newest first, always fresh (the Alerts page loads them on open). */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });
  if (await viewAsInfo()) return NextResponse.json([], { headers: { "Cache-Control": "no-store" } }); // her alerts are private
  const { data } = await supabase.from("notifications").select("id, title, body, url, read_at, created_at").eq("user_id", user.id).not("url", "like", "/coach/inbox%").order("created_at", { ascending: false }).limit(50);
  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
}
