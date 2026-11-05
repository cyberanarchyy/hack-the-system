import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import SectionHeading from "@/components/SectionHeading";
import { site } from "@/site.config";

export const metadata: Metadata = {
  title: "Support Us",
  description: "Help keep the NR Bloc open: donate, volunteer or donate kit.",
};

export default function SupportPage() {
  const { support } = site;

  return (
    <>
      <PageHeader kicker="Continue?" title="Support the Bloc">
        {support.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </PageHeader>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading title="Donate" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="panel-pink flex flex-col p-8">
            <h3 className="text-base text-white">GoFundMe</h3>
            <p className="mt-4 flex-1 text-foreground-dim">
              The easiest way to donate. Card payments, one-off or regular. Anything helps.
            </p>
            <a
              href={support.goFundMe}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-pink mt-8 self-start"
            >
              Donate
            </a>
          </div>
          <div className="panel p-8">
            <h3 className="text-base text-white">Bank Transfer</h3>
            <dl className="mt-6 space-y-4">
              {[
                ["Account name", support.bank.name],
                ["Sort code", support.bank.sortCode],
                ["Account number", support.bank.account],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-pixel text-[0.6rem] uppercase text-foreground-dim">
                    {label}
                  </dt>
                  <dd className="mt-1 font-pixel text-sm text-cyan">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <SectionHeading title="Other Ways to Help" />
        <div className="grid gap-6 md:grid-cols-3">
          {support.otherWays.map((w) => (
            <div key={w.title} className="panel p-6">
              <h3 className="text-sm text-yellow">{w.title}</h3>
              <p className="mt-3 text-foreground-dim">{w.text}</p>
            </div>
          ))}
        </div>
        <a
          href={`mailto:${site.email}?subject=${encodeURIComponent("I want to help out")}`}
          className="btn btn-cyan mt-10"
        >
          Get Involved
        </a>
      </section>
    </>
  );
}
