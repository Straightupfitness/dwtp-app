import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Tapping a Real Talk Tuesday reminder lands here: straight to Michael's Zoom link, or the calendar if none is set. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.from("program_settings").select("value").eq("key", "rtt_zoom_url").maybeSingle();
  const zoom = data?.value?.trim();
  return NextResponse.redirect(zoom && /^https:\/\//.test(zoom) ? zoom : new URL("/calendar", req.url));
}
