import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-32 text-center">
      <p className="pixel-shadow font-pixel text-4xl text-white sm:text-5xl">Game Over</p>
      <p className="mt-6 text-foreground-dim">That page doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-pink mt-10">
        Continue?
      </Link>
    </div>
  );
}
