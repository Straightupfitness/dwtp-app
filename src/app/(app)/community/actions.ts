"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyLater } from "@/lib/notify";
import { shortName } from "@/lib/names";

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { supabase, id: user.id, coach: p?.role === "coach" };
}
const done = () => revalidatePath("/community");

export async function createPost(body: string, photoPath: string | null, pinned: boolean) {
  const { supabase, id, coach } = await me();
  if (!body.trim() && !photoPath) return { error: "Write something or add a photo." };
  const { error } = await supabase.from("posts").insert({ author_id: id, body: body.trim(), photo_path: photoPath, pinned: coach && pinned });
  if (error) return { error: error.message };
  done();
  return { ok: true };
}

export async function toggleLike(postId: string, on: boolean) {
  const { supabase, id } = await me();
  if (on) await supabase.from("likes").upsert({ post_id: postId, user_id: id });
  else await supabase.from("likes").delete().match({ post_id: postId, user_id: id });
  done();
}

export async function addComment(postId: string, body: string, parentId: string | null = null) {
  const { supabase, id } = await me();
  if (!body.trim()) return;
  await supabase.from("comments").insert({ post_id: postId, author_id: id, body: body.trim(), parent_id: parentId });
  const [{ data: post }, { data: parent }, { data: who }] = await Promise.all([
    supabase.from("posts").select("author_id").eq("id", postId).single(),
    parentId ? supabase.from("comments").select("author_id").eq("id", parentId).single() : Promise.resolve({ data: null }),
    supabase.from("member_names").select("full_name, role").eq("id", id).single(),
  ]);
  const name = who?.role === "coach" ? "Michael" : shortName(who?.full_name);
  const notified = new Set<string>([id]);
  if (parent && !notified.has(parent.author_id)) {
    notified.add(parent.author_id);
    notifyLater(parent.author_id, { title: `${name} replied to your comment`, body: body.trim().slice(0, 120), url: "/community" });
  }
  if (post && !notified.has(post.author_id)) {
    notifyLater(post.author_id, { title: `${name} commented on your post`, body: body.trim().slice(0, 120), url: "/community" });
  }
  done();
}

export async function toggleCommentLike(commentId: string, on: boolean) {
  const { supabase, id } = await me();
  if (on) await supabase.from("comment_likes").upsert({ comment_id: commentId, user_id: id });
  else await supabase.from("comment_likes").delete().match({ comment_id: commentId, user_id: id });
  done();
}

export async function deletePost(postId: string) {
  const { supabase } = await me();
  const { data } = await supabase.from("posts").select("photo_path").eq("id", postId).single();
  await supabase.from("posts").delete().eq("id", postId);
  if (data?.photo_path) await supabase.storage.from("media").remove([data.photo_path]);
  done();
}

export async function deleteComment(commentId: string) {
  const { supabase } = await me();
  await supabase.from("comments").delete().eq("id", commentId);
  done();
}

export async function setPinned(postId: string, pinned: boolean) {
  const { supabase, coach } = await me();
  if (!coach) return;
  await supabase.from("posts").update({ pinned }).eq("id", postId);
  done();
}
