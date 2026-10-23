import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role").eq("id", user.id).single() : { data: null };
  return (
    <>
      <main className="mx-auto max-w-md px-4 pb-24 pt-6">{children}</main>
      <BottomNav coach={me?.role === "coach"} />
    </>
  );
}
