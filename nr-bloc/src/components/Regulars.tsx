import { site } from "@/site.config";
import EventTag from "@/components/EventTag";

export default function Regulars() {
  return (
    <div className="border-t-2 border-line">
      {site.regulars.map((r) => (
        <div
          key={r.title}
          className="grid grid-cols-[3.5rem_1fr] gap-4 border-b-2 border-line py-6 sm:grid-cols-[5rem_1fr] sm:gap-8"
        >
          <p className="font-pixel text-xs uppercase text-cyan sm:text-sm">{r.day}</p>
          <div>
            <h3 className="text-sm text-white sm:text-base">{r.title}</h3>
            <p className="mt-2 text-sm text-yellow">{r.time}, every week</p>
            <p className="mt-2 max-w-xl text-foreground-dim">{r.text}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.tags.map((t) => (
                <EventTag key={t} label={t} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
