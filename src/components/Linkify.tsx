/** Text with any https:// links made tappable (Community posts and comments). */
export default function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g);
  return <>{parts.map((p, i) => (i % 2
    ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline underline-offset-2">{p}</a>
    : p))}</>;
}
