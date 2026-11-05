import Link from "next/link";

export default function SectionHeading({
  title,
  link,
}: {
  title: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-line pb-4">
      <h2 className="text-xl text-white sm:text-2xl">{title}</h2>
      {link && (
        <Link
          href={link.href}
          className="font-pixel text-[0.65rem] uppercase text-yellow hover:text-white"
        >
          {link.label} ▸▸
        </Link>
      )}
    </div>
  );
}
