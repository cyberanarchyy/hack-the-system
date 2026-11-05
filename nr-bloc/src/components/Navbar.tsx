"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

const NAV_LINKS = [
  { href: "/whats-on", label: "What's On" },
  { href: "/gaming", label: "Gaming" },
  { href: "/hire", label: "Hire" },
  { href: "/support", label: "Support" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b-4 border-pink bg-background/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" onClick={() => setOpen(false)} aria-label="Home">
          <Logo />
        </Link>

        <div className="hidden gap-x-7 font-pixel text-[0.7rem] uppercase md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors hover:text-yellow ${
                  active ? "text-yellow" : "text-foreground-dim"
                }`}
              >
                <span className={active ? "" : "opacity-0"}>▸</span>
                {link.label}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="font-pixel text-[0.7rem] uppercase text-white md:hidden"
        >
          {open ? "✕ Close" : "≡ Menu"}
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t-2 border-line md:hidden">
          <p className="px-4 pt-4 font-pixel text-[0.6rem] uppercase text-foreground-dim">
            Select stage
          </p>
          <div className="flex flex-col px-4 pb-4">
            {NAV_LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`py-3 font-pixel text-sm uppercase ${
                    active ? "text-yellow" : "text-white"
                  }`}
                >
                  <span className={active ? "blink" : "opacity-0"}>▸</span> {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
