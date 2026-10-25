import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** The main address: signed in → her Today screen (Michael → his inbox); otherwise → sign in. */
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  redirect(me?.role === "coach" ? "/coach/inbox" : "/today");
}
