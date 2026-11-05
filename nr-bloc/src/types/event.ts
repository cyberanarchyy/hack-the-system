export const EVENT_TYPES = ["gig", "gaming", "event"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type EventFrontmatter = {
  title: string;
  date: string; // YYYY-MM-DD
  slug: string;
  type: EventType;
  time?: string;
  price?: string;
  ticketUrl?: string;
  poster?: string;
  posterWidth?: number;
  posterHeight?: number;
};

export type NrEvent = EventFrontmatter & { description: string };
