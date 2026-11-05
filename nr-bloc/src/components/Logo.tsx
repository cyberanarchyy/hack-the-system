import Image from "next/image";
import { site } from "@/site.config";

// The site logo: an image if one is set in site.config.ts, otherwise
// pixel text.
export default function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  if (site.logo) {
    return (
      <Image
        src={site.logo}
        alt={site.name}
        width={size === "lg" ? 480 : 160}
        height={size === "lg" ? 240 : 80}
        priority
        className={`w-auto object-contain ${size === "lg" ? "h-40 sm:h-56" : "h-10"}`}
      />
    );
  }

  if (size === "lg") {
    return (
      <span className="block font-pixel leading-none">
        <span className="block text-lg tracking-[0.3em] text-cyan sm:text-2xl">The</span>
        <span className="pixel-shadow mt-3 block text-5xl text-white sm:text-7xl lg:text-8xl">
          NR BLOC
        </span>
      </span>
    );
  }

  return (
    <span className="font-pixel text-sm leading-none text-white sm:text-base">
      <span className="text-cyan">THE</span> NR <span className="neon-pink">BLOC</span>
    </span>
  );
}
