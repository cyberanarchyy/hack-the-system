import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionHeading from "@/components/SectionHeading";
import { site } from "@/site.config";

export const metadata: Metadata = {
  title: "Venue Hire",
  description:
    "Hire the NR Bloc in Norwich for gigs, parties, gaming tournaments, workshops and launches.",
};

export default function HirePage() {
  const { hire } = site;
  const subject = encodeURIComponent("Venue hire enquiry");
  const body = encodeURIComponent(
    hire.enquiryChecklist.map((item) => `${item}:\n`).join("\n")
  );

  return (
    <>
      <PageHeader kicker="Your stage" title="Venue Hire">
        {hire.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </PageHeader>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading title="What You Can Put On" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {hire.uses.map((u, i) => (
            <div key={u.title} className="panel p-6">
              <h3 className={`text-sm ${["text-pink", "text-cyan", "text-yellow"][i % 3]}`}>
                {u.title}
              </h3>
              <p className="mt-3 text-foreground-dim">{u.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="panel-pink p-8 sm:p-10">
          <h2 className="text-lg text-white sm:text-xl">Make an Enquiry</h2>
          <p className="mt-4 max-w-2xl text-foreground-dim">{hire.note}</p>
          <p className="mt-6 font-pixel text-[0.65rem] uppercase text-yellow">Tell us:</p>
          <ul className="mt-4 space-y-2 text-white">
            {hire.enquiryChecklist.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="text-pink">▸</span>
                {item}
              </li>
            ))}
          </ul>
          <a
            href={`mailto:${site.email}?subject=${subject}&body=${body}`}
            className="btn btn-pink mt-8"
          >
            Email Us
          </a>
          <p className="mt-4 text-sm text-foreground-dim">{site.email}</p>
        </div>
      </section>
    </>
  );
}
