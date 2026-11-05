"use server";

import { redirect } from "next/navigation";
import { verifySession, deleteSession } from "@/lib/session";
import { commitFiles, createBlob, fileExists } from "@/lib/github";
import { slugify } from "@/lib/slugify";
import { IMAGE_EXTENSIONS, escapeYamlString, validateImageFile } from "@/lib/adminHelpers";
import { EVENT_TYPES, type EventType } from "@/types/event";

export type UploadResult = { ok: true; sha: string; ext: string } | { ok: false; message: string };

// Step 1 (only if there's a poster): send the bytes to GitHub as an
// uncommitted blob.
export async function uploadPoster(formData: FormData): Promise<UploadResult> {
  if (!(await verifySession())) {
    return { ok: false, message: "Not authorized. Log in again." };
  }

  const poster = formData.get("poster");
  if (!(poster instanceof File) || poster.size === 0) {
    return { ok: false, message: "No poster received." };
  }
  const err = validateImageFile(poster);
  if (err) return { ok: false, message: err };

  try {
    const sha = await createBlob(Buffer.from(await poster.arrayBuffer()));
    return { ok: true, sha, ext: IMAGE_EXTENSIONS[poster.type] };
  } catch (e) {
    return {
      ok: false,
      message: `Upload failed: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }
}

export type PublishInput = {
  title: string;
  date: string;
  type: string;
  time: string;
  price: string;
  ticketUrl: string;
  description: string;
  poster: { sha: string; ext: string; width: number; height: number } | null;
};

export type ActionState = {
  success: boolean;
  message: string;
};

// Step 2: commit the event file (and its poster) in one go.
export async function publishEvent(input: PublishInput): Promise<ActionState> {
  if (!(await verifySession())) {
    return { success: false, message: "Not authorized. Log in again." };
  }

  const title = String(input.title || "").trim();
  const time = String(input.time || "").trim();
  const price = String(input.price || "").trim();
  const ticketUrl = String(input.ticketUrl || "").trim();
  const description = String(input.description || "").trim();
  const type = (EVENT_TYPES as readonly string[]).includes(input.type)
    ? (input.type as EventType)
    : "event";

  if (!title) return { success: false, message: "A title is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { success: false, message: "Pick a date." };
  }
  if (ticketUrl && !/^https?:\/\//i.test(ticketUrl)) {
    return { success: false, message: "The ticket link must start with https://" };
  }
  const poster = input.poster;
  if (
    poster &&
    (!/^[0-9a-f]{40}$/.test(poster.sha) ||
      !Object.values(IMAGE_EXTENSIONS).includes(poster.ext) ||
      !(poster.width > 0) ||
      !(poster.height > 0))
  ) {
    return { success: false, message: "Poster data was invalid. Try again." };
  }

  // The date goes in the address so a band playing twice doesn't clash.
  const slug = slugify(`${title} ${input.date}`);
  if (!slugify(title)) {
    return { success: false, message: "Could not make a web address from that title." };
  }
  const eventPath = `content/events/${slug}.md`;

  try {
    if (await fileExists(eventPath)) {
      return {
        success: false,
        message: `There's already an event called "${title}" on that date.`,
      };
    }

    const posterSrc = poster ? `/images/events/${slug}.${poster.ext}` : null;
    const lines = [
      "---",
      `title: "${escapeYamlString(title)}"`,
      `date: "${input.date}"`,
      `slug: "${slug}"`,
      `type: "${type}"`,
    ];
    if (time) lines.push(`time: "${escapeYamlString(time)}"`);
    if (price) lines.push(`price: "${escapeYamlString(price)}"`);
    if (ticketUrl) lines.push(`ticketUrl: "${escapeYamlString(ticketUrl)}"`);
    if (poster && posterSrc) {
      lines.push(
        `poster: "${posterSrc}"`,
        `posterWidth: ${Math.round(poster.width)}`,
        `posterHeight: ${Math.round(poster.height)}`
      );
    }
    lines.push("---", "", description, "");

    await commitFiles(
      [
        ...(poster && posterSrc ? [{ path: `public${posterSrc}`, sha: poster.sha }] : []),
        { path: eventPath, content: lines.join("\n") },
      ],
      `Add event: ${title}`
    );
  } catch (e) {
    return {
      success: false,
      message: `Failed to publish: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }

  return {
    success: true,
    message: `Published! It'll be live at /whats-on/${slug} in a minute or two, once the site rebuilds.`,
  };
}

// The admin page passes the poster path along, so this doesn't need to read
// the content folder (which isn't bundled with server functions).
export async function deleteEvent(slug: string, poster?: string): Promise<ActionState> {
  if (!(await verifySession())) {
    return { success: false, message: "Not authorized. Log in again." };
  }

  slug = String(slug);
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { success: false, message: "Invalid event." };
  }
  const posterPath =
    poster && /^\/images\/events\/[a-z0-9-]+\.(jpg|png|webp|gif)$/.test(poster)
      ? `public${poster}`
      : null;
  const eventPath = `content/events/${slug}.md`;

  try {
    if (!(await fileExists(eventPath))) {
      return { success: false, message: "That event is already gone." };
    }
    const files: { path: string; sha: null }[] = [{ path: eventPath, sha: null }];
    if (posterPath && (await fileExists(posterPath))) {
      files.push({ path: posterPath, sha: null });
    }
    await commitFiles(files, `Remove event: ${slug}`);
  } catch (e) {
    return {
      success: false,
      message: `Failed to delete: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }

  return {
    success: true,
    message: "Deleted. It'll disappear from the site in a minute or two.",
  };
}

export async function logout() {
  await deleteSession();
  redirect("/admin/login");
}
