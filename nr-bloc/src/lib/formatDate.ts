const TZ = "Europe/London";

// Today's date in Norwich as YYYY-MM-DD, so an event stays listed
// until the end of its day, UK time.
export function todayInLondon(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

// Event dates are plain YYYY-MM-DD strings; read them at midday UTC so the
// weekday can't slip a day either side.
function parse(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

// "Sat 14 Dec"
export function formatShort(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(parse(date));
}

// "Saturday 14 December 2026"
export function formatLong(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parse(date));
}

// { day: "14", month: "DEC" } for the date block on event cards
export function dateParts(date: string): { day: string; month: string; weekday: string } {
  const d = parse(date);
  const part = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...o }).format(d);
  return {
    day: part({ day: "numeric" }),
    month: part({ month: "short" }).toUpperCase(),
    weekday: part({ weekday: "short" }).toUpperCase(),
  };
}
