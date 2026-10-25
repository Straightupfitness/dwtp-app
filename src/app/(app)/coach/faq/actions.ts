"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { textToLinks } from "@/lib/faq";

async function coach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  if (me?.role !== "coach") throw new Error("Coach only");
  return supabase;
}
const done = () => { revalidatePath("/faq"); revalidatePath("/coach/faq"); };

export async function saveItem(form: FormData) {
  const supabase = await coach();
  const id = String(form.get("id") ?? "");
  const row = {
    section_id: String(form.get("section_id")), kind: String(form.get("kind") ?? "qa"),
    title: String(form.get("title") ?? "").trim(), body: String(form.get("body") ?? "").trim() || null,
    video_url: String(form.get("video_url") ?? "").trim() || null,
    links: textToLinks(String(form.get("links") ?? "")), sort: Number(form.get("sort") ?? 0) || 0,
  };
  if (!row.title) return { error: "Give it a title." };
  const { error } = id ? await supabase.from("faq_items").update(row).eq("id", id) : await supabase.from("faq_items").insert(row);
  if (error) return { error: error.message };
  done();
  return { ok: true };
}

export async function deleteItem(id: string) {
  const supabase = await coach();
  await supabase.from("faq_items").delete().eq("id", id);
  done();
}

export async function saveSection(form: FormData) {
  const supabase = await coach();
  const id = String(form.get("id") ?? "");
  const row = { title: String(form.get("title") ?? "").trim(), intro: String(form.get("intro") ?? "").trim() || null, sort: Number(form.get("sort") ?? 0) || 0 };
  if (!row.title) return { error: "Give the section a title." };
  const { error } = id ? await supabase.from("faq_sections").update(row).eq("id", id) : await supabase.from("faq_sections").insert(row);
  if (error) return { error: error.message };
  done();
  return { ok: true };
}

export async function deleteSection(id: string) {
  const supabase = await coach();
  await supabase.from("faq_sections").delete().eq("id", id);
  done();
}
