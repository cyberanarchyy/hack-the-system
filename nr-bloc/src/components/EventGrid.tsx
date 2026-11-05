import type { NrEvent } from "@/types/event";
import EventCard from "@/components/EventCard";
import { site } from "@/site.config";

export default function EventGrid({ events }: { events: NrEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <p className="font-pixel text-xs uppercase text-yellow">
          <span className="blink">Loading next level...</span>
        </p>
        <p className="mt-4 text-foreground-dim">
          No one-off events announced right now. Our weekly nights are still on, and you can{" "}
          <a href={`mailto:${site.email}`} className="text-white underline hover:text-cyan">
            get in touch
          </a>{" "}
          to put something on.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <EventCard key={e.slug} event={e} />
      ))}
    </div>
  );
}
