"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Re-render the page when these tables change (Supabase Realtime), so new posts and messages appear live. */
export default function LiveRefresh({ tables, filter }: { tables: string[]; filter?: string }) {
  const router = useRouter();
  const tablesKey = tables.join(",");
  useEffect(() => {
    const supabase = createClient();
    let t: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => { if (t) clearTimeout(t); t = setTimeout(() => router.refresh(), 250); };
    const ch = supabase.channel(`live:${tablesKey}:${filter ?? "all"}`);
    for (const table of tablesKey.split(",")) {
      ch.on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, refresh);
    }
    ch.subscribe();
    return () => { if (t) clearTimeout(t); supabase.removeChannel(ch); };
  }, [tablesKey, filter, router]);
  return null;
}
