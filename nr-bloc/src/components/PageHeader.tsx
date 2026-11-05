export default function PageHeader({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b-2 border-line">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="font-pixel text-[0.65rem] uppercase text-cyan">{kicker}</p>
        <h1 className="pixel-shadow mt-4 text-3xl text-white sm:text-5xl">{title}</h1>
        {children && (
          <div className="mt-6 max-w-2xl space-y-4 text-lg text-foreground-dim">{children}</div>
        )}
      </div>
    </div>
  );
}
