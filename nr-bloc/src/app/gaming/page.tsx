import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SectionHeading from "@/components/SectionHeading";
import { site } from "@/site.config";

export const metadata: Metadata = {
  title: "Retro Gaming",
  description: "Retro consoles on free play at the NR Bloc, Norwich.",
};

export default function GamingPage() {
  const { gaming } = site;

  return (
    <>
      <PageHeader kicker="Player 1 start" title="Retro Gaming">
        {gaming.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </PageHeader>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading title="Select Your Console" />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {gaming.consoles.map((c, i) => (
            <li
              key={c}
              className="panel flex items-center gap-3 p-4 font-pixel text-[0.65rem] uppercase leading-relaxed text-white sm:text-xs"
            >
              <span className={["text-pink", "text-cyan", "text-yellow", "text-green"][i % 4]}>
                ■
              </span>
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {gaming.points.map((p) => (
            <div key={p.title} className="panel p-6">
              <h3 className="text-sm text-cyan">{p.title}</h3>
              <p className="mt-3 text-foreground-dim">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="panel-pink flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base text-white sm:text-lg">Got a tournament in mind?</h2>
            <p className="mt-3 text-foreground-dim">
              Hire the room and we&apos;ll get the screens and consoles set up.
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
