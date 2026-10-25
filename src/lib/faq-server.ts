import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FaqItem, FaqSection } from "./faq";

export async function loadFaq(supabase: SupabaseClient): Promise<FaqSection[]> {
  const [{ data: sections }, { data: items }] = await Promise.all([
    supabase.from("faq_sections").select("id, slug, title, intro, sort").order("sort"),
    supabase.from("faq_items").select("id, section_id, kind, title, body, video_url, links, sort").order("sort"),
  ]);
  return (sections ?? []).map((s) => ({ ...s, items: ((items ?? []) as FaqItem[]).filter((i) => i.section_id === s.id) }));
}

