"use client";

import { useState } from "react";
import { deleteEvent } from "@/app/admin/actions";

export default function DeleteEventButton({
  slug,
  title,
  poster,
}: {
  slug: string;
  title: string;
  poster?: string;
}) {
  const [state, setState] = useState<"idle" | "confirm" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function run() {
    setState("busy");
    const res = await deleteEvent(slug, poster).catch(() => ({
      success: false,
      message: "Network error. Try again.",
    }));
    setMessage(res.message);
    setState(res.success ? "done" : "error");
  }

  if (state === "done") {
    return <span className="text-sm text-green">Deleted</span>;
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {state === "confirm" ? (
        <span className="flex gap-3 text-sm">
          <button type="button" onClick={run} className="text-pink underline">
            Delete &ldquo;{title}&rdquo;
          </button>
          <button
            type="button"
            onClick={() => setState("idle")}
            className="text-foreground-dim underline"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setState("confirm")}
          disabled={state === "busy"}
          className="text-sm text-foreground-dim underline hover:text-pink disabled:opacity-50"
        >
          {state === "busy" ? "Deleting..." : "Delete"}
        </button>
      )}
      {state === "error" && <span className="text-xs text-red-300">{message}</span>}
    </div>
  );
}
