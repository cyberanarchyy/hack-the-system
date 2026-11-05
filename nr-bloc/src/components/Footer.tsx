import Link from "next/link";
import { site } from "@/site.config";

export default function Footer() {
  return (
    <footer className="border-t-4 border-pink bg-panel">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="font-pixel text-sm text-white">
            Game <span className="neon-pink">Over?</span>
          </p>
          <p className="mt-3 font-pixel text-[0.6rem] uppercase text-yellow">
            <span className="blink">Insert coin</span> to continue
          </p>
          <p className="mt-5 text-sm text-foreground-dim">{site.houseRules}</p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-foreground-dim sm:items-end">
          <a href={`mailto:${site.email}`} className="text-white underline hover:text-cyan">
            {site.email}
          </a>
          {site.links.length > 0 && (
            <p className="flex gap-4">
              {site.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan"
                >
                  {l.label}
                </a>
              ))}
            </p>
          )}
          <p>
            <Link href="/hire" className="hover:text-cyan">
              Hire the space
            </Link>{" "}
            ·{" "}
            <Link href="/support" className="hover:text-cyan">
              Support us
            </Link>
          </p>
          <p>
            &copy; {new Date().getFullYear()} {site.name}, {site.location}
          </p>
        </div>
      </div>
    </footer>
  );
}
