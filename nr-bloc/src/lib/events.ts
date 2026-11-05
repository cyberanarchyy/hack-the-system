import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { EVENT_TYPES, type EventFrontmatter, type NrEvent } from "@/types/event";
import { todayInLondon } from "@/lib/formatDate";

const EVENTS_DIRECTORY = path.join(process.cwd(), "content", "events");

const REQUIRED_FIELDS: (keyof EventFrontmatter)[] = ["title", "date", "slug", "type"];

function readEventFile(fileName: string): NrEvent {
  const raw = fs.readFileSync(path.join(EVENTS_DIRECTORY, fileName), "utf-8");
  const { data, content } = matter(raw);

  for (const field of REQUIRED_FIELDS) {
    if (!data[field]) {
      throw new Error(`Event "${fileName}" is missing required frontmatter field "${field}".`);
    }
  }
  if (!EVENT_TYPES.includes(data.type)) {
    throw new Error(
      `Event "${fileName}" has type "${data.type}". Use one of: ${EVENT_TYPES.join(", ")}.`
    );
  }
  // gray-matter turns unquoted YAML dates into Date objects
  const date =
    data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date);

  return { ...(data as EventFrontmatter), date, description: content.trim() };
}

export function getAllEvents(): NrEvent[] {
  if (!fs.existsSync(EVENTS_DIRECTORY)) return [];

  return fs
    .readdirSync(EVENTS_DIRECTORY)
    .filter((fileName) => fileName.endsWith(".md"))
    .map(readEventFile)
    .sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
}

// Today's and future events, soonest first.
export function getUpcomingEvents(): NrEvent[] {
  const today = todayInLondon();
  return getAllEvents().filter((e) => e.date >= today);
}

export function getEventBySlug(slug: string): NrEvent | undefined {
  return getAllEvents().find((e) => e.slug === slug);
}

export const EVENT_TYPE_LABELS: Record<NrEvent["type"], string> = {
  gig: "Gig",
  gaming: "Gaming",
  event: "Event",
};
