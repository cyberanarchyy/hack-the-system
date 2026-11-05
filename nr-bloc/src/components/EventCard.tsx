import Link from "next/link";
import Image from "next/image";
import type { NrEvent } from "@/types/event";
import { EVENT_TYPE_LABELS } from "@/lib/events";
import { dateParts } from "@/lib/formatDate";
import EventTag from "@/components/EventTag";

export default function EventCard({ event }: { event: NrEvent }) {
  const d = dateParts(event.date);

  return (
    <Link
      href={`/whats-on/${event.slug}`}
      className="group panel flex flex-col transition-colors hover:border-pink"
    >
      <div className="relative aspect-[4/5] overflow-hidden border-b-2 border-line bg-background">
        {event.poster ? (
          <Image
            src={event.poster}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="arcade-grid arcade-grid-sm absolute inset-0" />
        )}
        <div className="absolute left-3 top-3 border-2 border-white bg-background px-3 py-2 text-center font-pixel shadow-[3px_3px_0_#000]">
          <span className="block text-[0.55rem] text-cyan">{d.weekday}</span>
          <span className="mt-1 block text-xl text-white">{d.day}</span>
          <span className="mt-1 block text-[0.55rem] text-pink">{d.month}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap gap-2">
          <EventTag label={EVENT_TYPE_LABELS[event.type]} />
          {event.price && <EventTag label={event.price} />}
        </div>
        <h3 className="text-sm leading-relaxed text-white group-hover:text-yellow">
          {event.title}
        </h3>
        {event.time && <p className="text-sm text-foreground-dim">{event.time}</p>}
      </div>
    </Link>
  );
}
