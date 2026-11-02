/**
 * Text with its web links made tappable (Community posts and comments; chat messages since November 1).
 * Handles https://… and www.… links; trailing punctuation stays outside the link.
 */
export default function Linkify({ text, className = "break-all text-accent underline underline-offset-2" }: { text: string; className?: string }) {
  const parts = text.split(/((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)"'\]])/gi);
  return <>{parts.map((p, i) => (i % 2
    ? <a key={i} href={/^https?:\/\//i.test(p) ? p : `https://${p}`} target="_blank" rel="noopener noreferrer" className={className}>{p}</a>
    : p))}</>;
}
