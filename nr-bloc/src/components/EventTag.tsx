const COLOURS: Record<string, string> = {
  gig: "bg-pink text-white",
  gaming: "bg-cyan text-background",
  event: "bg-yellow text-background",
  weekly: "bg-pink text-white",
  free: "bg-green text-background",
};

export default function EventTag({ label }: { label: string }) {
  const colour = COLOURS[label.toLowerCase()] ?? "border-2 border-line text-foreground-dim";
  return <span className={`tag ${colour}`}>{label}</span>;
}
