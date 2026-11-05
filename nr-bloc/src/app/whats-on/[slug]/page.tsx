import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EVENT_TYPE_LABELS, getAllEvents, getEventBySlug } from "@/lib/events";
import { formatLong, todayInLondon } from "@/lib/formatDate";
import EventTag from "@/components/EventTag";
import { site } from "@/site.config";

export function generateStaticParams() {
  return getAllEvents().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/whats-on/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) return { title: "Not Found" };

  const description =
    event.description.split("\n")[0] || `${formatLong(event.date)} at ${site.name}`;
  return {
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      images: event.poster ? [{ url: event.poster }] : undefined,
    },
  };
}

export default async function EventPage({ params }: PageProps<"/whats-on/[slug]">) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) notFound();

  const past = event.date < todayInLondon();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/whats-on"
        className="font-pixel text-[0.65rem] uppercase text-foreground-dim hover:text-yellow"
      >
        ◂ Back to What&apos;s On
      </Link>

      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          {event.poster ? (
            <Image
              src={event.poster}
              alt={`Poster for ${event.title}`}
              width={event.posterWidth ?? 1200}
              height={event.posterHeight ?? 1500}
              sizes="(min-width: 768px) 40vw, 100vw"
              priority
              className="h-auto w-full border-4 border-white shadow-[8px_8px_0_var(--pink)]"
            />
          ) : (
            <div className="arcade-grid arcade-grid-sm relative aspect-[4/5] overflow-hidden border-4 border-white shadow-[8px_8px_0_var(--pink)]" />
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            <EventTag label={EVENT_TYPE_LABELS[event.type]} />
            {event.price && <EventTag label={event.price} />}
            {past && <EventTag label="Past event" />}
          </div>
          <h1 className="pixel-shadow mt-6 text-2xl leading-snug text-white sm:text-4xl">
            {event.title}
          </h1>
          <dl className="mt-8 space-y-3 font-pixel text-[0.7rem] uppercase leading-relaxed">
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-foreground-dim">Date</dt>
              <dd className="text-cyan">{formatLong(event.date)}</dd>
            </div>
            {event.time && (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-foreground-dim">Time</dt>
                <dd className="text-cyan">{event.time}</dd>
              </div>
            )}
            {event.price && (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-foreground-dim">Entry</dt>
                <dd className="text-cyan">{event.price}</dd>
              </div>
            )}
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-foreground-dim">Where</dt>
              <dd className="text-cyan">
                {site.name}, {site.location}
              </dd>
            </div>
          </dl>

          {event.description && (
            <div className="mt-8 space-y-4 text-lg text-foreground-dim">
              {event.description.split(/\n{2,}/).map((para, i) => (
                <p key={i} className="whitespace-pre-line">
                  {para}
                </p>
              ))}
            </div>
          )}

          {event.ticketUrl && !past && (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-pink mt-10"
            >
              Get Tickets
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
