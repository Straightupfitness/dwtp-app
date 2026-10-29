import Link from "next/link";
import Linkify from "@/components/Linkify";
import { createClient } from "@/lib/supabase/server";
import { shortName, timeAgo } from "@/lib/names";
import LiveRefresh from "@/components/LiveRefresh";
import Avatar from "@/components/Avatar";
import { BadgeRow } from "@/components/BadgeIcon";
import Composer from "./Composer";
import { CommentBox, CommentLike, DeleteButton, LikeButton, PinButton } from "./PostActions";

const display = "font-[family-name:var(--font-display)] uppercase";
const MEDAL = ["#f5a623", "#c9c9c9", "#b87333"];
type Member = { id: string; full_name: string | null; role: string; avatar_path: string | null };
type Comment = { id: string; post_id: string; author_id: string; body: string; created_at: string; parent_id: string | null };

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ tab?: string; board?: string }> }) {
  const { tab, board } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;
  const { data: names } = await supabase.from("member_names").select("id, full_name, role, avatar_path");
  // Badges show next to her name (October 29).
  const { data: badgeRows } = await supabase.from("badges_earned").select("client_id, badge, earned_at").order("earned_at");
  const badgesOf = new Map<string, string[]>();
  for (const b of badgeRows ?? []) badgesOf.set(b.client_id, [...(badgesOf.get(b.client_id) ?? []), b.badge]);
  const members = new Map((names as Member[] ?? []).map((n) => [n.id, n]));
  const coach = members.get(me)?.role === "coach";
  const who = (id: string) => (members.get(id)?.role === "coach" ? "Michael" : shortName(members.get(id)?.full_name));
  const isCoach = (id: string) => members.get(id)?.role === "coach";

  const Tabs = (
    <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1">
      {[["feed", "Feed"], ["leaderboard", "Leaderboard"]].map(([v, l]) => (
        <Link key={v} href={v === "feed" ? "/community" : "/community?tab=leaderboard"} aria-current={(tab ?? "feed") === v ? "page" : undefined}
          className={`flex min-h-10 items-center justify-center rounded-xl text-sm font-semibold ${(tab ?? "feed") === v ? "bg-accent text-black" : "text-dim"}`}>{l}</Link>
      ))}
    </div>
  );
  const header = (
    <header>
      <p className="text-[11px] uppercase tracking-[0.15em] text-accent">Get involved</p>
      <h1 className={`${display} mt-1 text-[30px] font-semibold`}>Community</h1>
    </header>
  );

  const { data: weekRows } = await supabase.from("leaderboard_this_week").select("client_id, full_name, cps").order("cps", { ascending: false }).limit(200);
  const ranked = (weekRows ?? []).filter((r) => r.cps > 0 || r.client_id === me);

  if (tab === "leaderboard") {
    const all = board === "all";
    const rows = all
      ? ((await supabase.from("leaderboard_all_time").select("client_id, full_name, cps").order("cps", { ascending: false }).limit(50)).data ?? []).filter((r) => r.cps > 0 || r.client_id === me)
      : ranked.slice(0, 50);
    return (
      <section className="space-y-4">
        {header}{Tabs}
        <div className="flex justify-center gap-6 text-sm">
          <Link href="/community?tab=leaderboard" className={`min-h-9 ${!all ? "text-accent underline underline-offset-4" : "text-dim"}`}>This week</Link>
          <Link href="/community?tab=leaderboard&board=all" className={`min-h-9 ${all ? "text-accent underline underline-offset-4" : "text-dim"}`}>All time</Link>
        </div>
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.client_id} className={`flex items-center gap-3 rounded-2xl border p-2.5 ${r.client_id === me ? "border-accent bg-[#1f1708]" : "border-border bg-card"}`}>
              <span className={`grid size-7 shrink-0 place-items-center rounded-full ${display} text-sm`}
                style={i < 3 ? { background: MEDAL[i], color: "#0a0a0a" } : { color: "#8a8a8a" }}>{i + 1}</span>
              <Avatar name={r.full_name} path={members.get(r.client_id)?.avatar_path} size={36} />
              <span className="flex-1 text-[15px]">{shortName(r.full_name)}{r.client_id === me ? <span className="text-dim"> (you)</span> : ""} <BadgeRow badges={badgesOf.get(r.client_id) ?? []} size={14} /></span>
              <span className={`${display} text-lg`}>{r.cps} <span className="text-xs text-dim">CPs</span></span>
            </li>
          ))}
          {!rows.length && <p className="text-dim">No points yet this week. Check off a habit to get on the board.</p>}
        </ol>
        {!all && <p className="text-center text-xs text-dim">Resets every Monday, so anyone can top the board.</p>}
      </section>
    );
  }


  const { data: posts } = await supabase.from("posts").select("id, author_id, body, photo_path, pinned, created_at")
    .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);
  const ids = (posts ?? []).map((p) => p.id);
  const [{ data: comments }, { data: likes }] = await Promise.all([
    ids.length ? supabase.from("comments").select("id, post_id, author_id, body, created_at, parent_id").in("post_id", ids).order("created_at") : { data: [] },
    ids.length ? supabase.from("likes").select("post_id, user_id").in("post_id", ids) : { data: [] },
  ]);
  const cids = (comments ?? []).map((c) => c.id);
  const { data: clikes } = cids.length ? await supabase.from("comment_likes").select("comment_id, user_id").in("comment_id", cids) : { data: [] };
  const photos = new Map<string, string>();
  const paths = (posts ?? []).map((p) => p.photo_path).filter(Boolean) as string[];
  if (paths.length) {
    const { data } = await supabase.storage.from("media").createSignedUrls(paths, 3600);
    data?.forEach((d) => d.path && d.signedUrl && photos.set(d.path, d.signedUrl));
  }

  const CommentRow = ({ c, postId, reply = false }: { c: Comment; postId: string; reply?: boolean }) => {
    const ls = (clikes ?? []).filter((l) => l.comment_id === c.id);
    return (
      <div className={`flex gap-2 ${reply ? "ml-10" : ""}`}>
        <Avatar name={who(c.author_id)} path={members.get(c.author_id)?.avatar_path} size={reply ? 26 : 30} coach={isCoach(c.author_id)} />
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-[#1d1d1d] px-3 py-2">
            <p className={`text-[13px] font-semibold ${isCoach(c.author_id) ? "text-accent" : ""}`}>{who(c.author_id)} <BadgeRow badges={badgesOf.get(c.author_id) ?? []} size={14} /></p>
            <p className="whitespace-pre-line text-[14px] leading-snug"><Linkify text={c.body} /></p>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <span className="text-xs text-dim">{timeAgo(c.created_at)}</span>
            <CommentLike commentId={c.id} liked={ls.some((l) => l.user_id === me)} count={ls.length} />
            <CommentBox postId={postId} parentId={c.parent_id ?? c.id} replyTo={reply ? who(c.author_id) : undefined} compact />
            {(c.author_id === me || coach) && <DeleteButton kind="comment" id={c.id} />}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-3.5">
      <LiveRefresh tables={["posts", "comments", "likes", "comment_likes"]} />
      {header}{Tabs}

      <Composer userId={me} coach={coach} />

      {(posts ?? []).map((p) => {
        const cs = (comments ?? []) as Comment[];
        const top = cs.filter((c) => c.post_id === p.id && !c.parent_id);
        const replies = (id: string) => cs.filter((c) => c.parent_id === id);
        const count = cs.filter((c) => c.post_id === p.id).length;
        const ls = (likes ?? []).filter((l) => l.post_id === p.id);
        const shown = top.slice(-2), hidden = top.slice(0, -2);
        const thread = (list: Comment[]) => list.map((c) => (
          <div key={c.id} className="space-y-2">
            <CommentRow c={c} postId={p.id} />
            {replies(c.id).map((r) => <CommentRow key={r.id} c={r} postId={p.id} reply />)}
          </div>
        ));
        return (
          <article key={p.id} className={`space-y-2.5 rounded-[18px] border p-3.5 ${p.pinned ? "border-accent bg-[#1a1409]" : "border-border bg-card"}`}>
            <div className="flex items-center gap-2.5">
              <Avatar name={who(p.author_id)} path={members.get(p.author_id)?.avatar_path} size={38} coach={isCoach(p.author_id)} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${isCoach(p.author_id) ? "text-accent" : ""}`}>{who(p.author_id)}{isCoach(p.author_id) ? " · Coach" : ""} <BadgeRow badges={badgesOf.get(p.author_id) ?? []} size={16} /></p>
                <p className="text-xs text-[#a8a8a8]">{p.pinned ? "Pinned · " : ""}{timeAgo(p.created_at)}</p>
              </div>
              {coach && <PinButton id={p.id} pinned={p.pinned} />}
              {(p.author_id === me || coach) && <DeleteButton kind="post" id={p.id} />}
            </div>
            {p.body && <p className="whitespace-pre-line text-[15px] leading-relaxed"><Linkify text={p.body} /></p>}
            {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL */}
            {p.photo_path && photos.get(p.photo_path) && <img src={photos.get(p.photo_path)} alt="" className="w-full rounded-[14px]" />}
            <div className="flex items-center gap-4 border-t border-border pt-1">
              <LikeButton postId={p.id} liked={ls.some((l) => l.user_id === me)} count={ls.length} />
              <span className="text-sm text-dim">{count ? `${count} comment${count > 1 ? "s" : ""}` : ""}</span>
            </div>
            {hidden.length > 0 && (
              <details className="space-y-2">
                <summary className="min-h-9 cursor-pointer list-none text-[13px] font-semibold text-dim">View {hidden.length} earlier comment{hidden.length > 1 ? "s" : ""}</summary>
                <div className="space-y-2 pt-2">{thread(hidden)}</div>
              </details>
            )}
            {shown.length > 0 && <div className="space-y-2">{thread(shown)}</div>}
            <CommentBox postId={p.id} />
          </article>
        );
      })}
      {!posts?.length && <p className="text-dim">No posts yet. Be the first: share a win from this week.</p>}
    </section>
  );
}
