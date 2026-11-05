import Link from "next/link";
import Image from "next/image";
import { getUpcomingEvents } from "@/lib/events";
import EventGrid from "@/components/EventGrid";
import Regulars from "@/components/Regulars";
import SectionHeading from "@/components/SectionHeading";
import Logo from "@/components/Logo";
import { site } from "@/site.config";

// Rebuild hourly so past events drop off without a new deploy.
export const revalidate = 3600;

const FEATURE_COLOURS = ["text-cyan", "text-pink", "text-yellow"];

export default function Home() {
  const events = getUpcomingEvents().slice(0, 6);

  return (
    <>
      <section
        className={`relative overflow-hidden border-b-4 border-pink ${
          site.heroImage ? "bg-background" : "arcade-grid"
        }`}
      >
        {site.heroImage && (
          <>
            <Image
              src={site.heroImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background/95" />
          </>
        )}

        <div className="relative mx-auto flex min-h-[36rem] max-w-6xl flex-col items-center justify-center px-4 py-24 text-center sm:min-h-[40rem] sm:px-6">
          <p className="font-pixel text-[0.65rem] uppercase text-yellow">
            <span className="blink">● </span>Now playing in {site.location}
          </p>
          <h1 className="mt-8">
            <Logo size="lg" />
            <span className="sr-only"> — {site.tagline}</span>
          </h1>
          <p className="mt-8 max-w-xl font-pixel text-[0.7rem] uppercase leading-loose text-cyan sm:text-xs">
            {site.tagline}
          </p>
          <p className="mt-6 max-w-xl text-lg text-white [text-shadow:0_2px_8px_#000]">
            {site.intro}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/whats-on" className="btn btn-pink">
              What&apos;s On
            </Link>
            <Link href="/hire" className="btn btn-cyan">
              Hire the Space
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {site.features.map((f, i) => (
            <Link key={f.title} href={f.href} className="group panel p-6 transition-colors hover:border-pink">
              <p className="font-pixel text-[0.6rem] uppercase text-foreground-dim">
                Player {i + 1}
              </p>
              <h2 className={`mt-4 text-lg ${FEATURE_COLOURS[i % 3]}`}>{f.title}</h2>
              <p className="mt-4 text-foreground-dim">{f.text}</p>
              <p className="mt-6 font-pixel text-[0.6rem] uppercase text-white group-hover:text-yellow">
                Press start ▸
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <SectionHeading title="Coming Up" link={{ href: "/whats-on", label: "Full listings" }} />
        <EventGrid events={events} />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <SectionHeading title="Every Week" />
        <Regulars />
      </section>

      <section className="border-y-2 border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg text-white sm:text-xl">
              Want to put something on<span className="neon-pink">?</span>
            </h2>
            <p className="mt-3 max-w-xl text-foreground-dim">
              Gigs, parties, tournaments, workshops. The room is available to hire at
              community rates.
            </p>
          </div>
          <Link href="/hire" className="btn btn-pink shrink-0">
            Venue Hire
          </Link>
        </div>
      </section>
    </>
  );
}
