import type { Metadata } from "next";
import { getUpcomingEvents } from "@/lib/events";
import EventGrid from "@/components/EventGrid";
import Regulars from "@/components/Regulars";
import PageHeader from "@/components/PageHeader";
import SectionHeading from "@/components/SectionHeading";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "What's On",
  description: "Gigs, gaming nights and events at the NR Bloc, Norwich.",
};

export default function WhatsOnPage() {
  const events = getUpcomingEvents();

  return (
    <>
      <PageHeader kicker="Stage select" title="What's On">
        <p>Gigs, gaming nights and everything else coming up at the Bloc.</p>
      </PageHeader>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading title="Coming Up" />
        <EventGrid events={events} />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <SectionHeading title="Every Week" />
        <Regulars />
      </section>
    </>
  );
}
