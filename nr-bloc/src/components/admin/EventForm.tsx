"use client";

import { useRef, useState } from "react";
import { publishEvent, uploadPoster, type ActionState } from "@/app/admin/actions";
import { compressImage, type CompressedImage } from "@/lib/compressImage";
import { EVENT_TYPES } from "@/types/event";

const inputClass =
  "border-2 border-line bg-background p-3 text-base text-foreground focus:border-cyan focus:outline-none";
const labelClass = "text-sm text-foreground-dim";

const TYPE_LABELS: Record<(typeof EVENT_TYPES)[number], string> = {
  gig: "Gig",
  gaming: "Gaming",
  event: "Other event",
};

function isHeic(file: File): boolean {
  return /heic|heif/i.test(file.type) || /\.heic$|\.heif$/i.test(file.name);
}

export default function EventForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [poster, setPoster] = useState<(CompressedImage & { preview: string }) | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<ActionState | null>(null);
  const busy = status !== null;

  function clearPoster() {
    if (poster) URL.revokeObjectURL(poster.preview);
    setPoster(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);
    setStatus("Optimizing poster...");
    try {
      const c = await compressImage(file, 1600);
      clearPoster();
      setPoster({ ...c, preview: URL.createObjectURL(c.file) });
    } catch {
      setResult({
        success: false,
        message:
          `Couldn't read ${file.name}.` +
          (isHeic(file)
            ? " HEIC photos only work in some browsers. On iPhone: Settings → Camera → Formats → Most Compatible, or export as JPEG."
            : ""),
      });
    }
    setStatus(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setResult(null);

    let uploaded: { sha: string; ext: string; width: number; height: number } | null = null;
    if (poster) {
      setStatus("Uploading poster...");
      const fd = new FormData();
      fd.append("poster", poster.file);
      const res = await uploadPoster(fd).catch(() => ({
        ok: false as const,
        message: "Network error. Check your connection and try again.",
      }));
      if (!res.ok) {
        setStatus(null);
        setResult({ success: false, message: res.message });
        return;
      }
      uploaded = { sha: res.sha, ext: res.ext, width: poster.width, height: poster.height };
    }

    setStatus("Publishing...");
    const get = (k: string) => String(form.get(k) || "");
    const res = await publishEvent({
      title: get("title"),
      date: get("date"),
      type: get("type"),
      time: get("time"),
      price: get("price"),
      ticketUrl: get("ticketUrl"),
      description: get("description"),
      poster: uploaded,
    }).catch(() => ({ success: false, message: "Network error. Try again." }));
    setStatus(null);
    setResult(res);

    if (res.success) {
      formRef.current?.reset();
      clearPoster();
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="title" className={labelClass}>
          Title <span className="text-pink">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g. Band name + support"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="date" className={labelClass}>
            Date <span className="text-pink">*</span>
          </label>
          <input id="date" name="date" type="date" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="type" className={labelClass}>
            Type
          </label>
          <select id="type" name="type" defaultValue="gig" className={inputClass}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="time" className={labelClass}>
            Time
          </label>
          <input id="time" name="time" type="text" placeholder="7pm till 11pm" className={inputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="price" className={labelClass}>
            Price
          </label>
          <input id="price" name="price" type="text" placeholder="£5 / Free" className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="ticketUrl" className={labelClass}>
          Ticket link (optional)
        </label>
        <input
          id="ticketUrl"
          name="ticketUrl"
          type="url"
          placeholder="https://"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className={labelClass}>
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          placeholder="Line-up, what to expect, age limits..."
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={labelClass}>Poster (optional)</span>
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={busy}
          className="sr-only"
          id="poster"
        />
        {poster ? (
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster.preview} alt="Poster preview" className="w-32 border-2 border-line" />
            <div className="flex flex-col gap-2 text-sm">
              <label htmlFor="poster" className="cursor-pointer text-cyan underline">
                Change
              </label>
              <button
                type="button"
                onClick={clearPoster}
                disabled={busy}
                className="text-left text-foreground-dim underline hover:text-pink"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label
            htmlFor="poster"
            className="cursor-pointer border-2 border-dashed border-line p-6 text-center text-foreground-dim hover:border-cyan hover:text-white"
          >
            Tap to choose a poster
          </label>
        )}
      </div>

      <button type="submit" disabled={busy} className="btn btn-pink self-start disabled:opacity-50">
        {status ?? "Publish"}
      </button>

      {result?.message && (
        <p className={result.success ? "text-sm text-green" : "text-sm text-red-300"}>
          {result.message}
        </p>
      )}
    </form>
  );
}
