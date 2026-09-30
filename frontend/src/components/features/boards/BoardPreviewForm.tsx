"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { Board } from "@/types/board";

const inputClasses =
  "mt-2 w-full rounded border border-line bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function BoardPreviewForm() {
  const [preview, setPreview] = useState<Board | null>(null);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Keep the browser on this page instead of submitting to a server.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const readText = (name: string) => String(formData.get(name) ?? "").trim();
    const title = readText("title");
    const country = readText("country");
    const countryCode = readText("countryCode").toUpperCase();
    const cities = splitList(readText("cities"));
    const visibility = readText("visibility");

    setPreview(null);
    setError("");

    if (!title) {
      setError("Enter a Board title containing more than spaces.");
      return;
    }

    if ((country || countryCode || cities.length > 0) && (!country || !countryCode)) {
      setError("To add a destination, enter both its country and two-letter country code.");
      return;
    }

    if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
      setError("Use a two-letter country code, such as SE for Sweden.");
      return;
    }

    if (visibility !== "private" && visibility !== "friends" && visibility !== "public") {
      setError("Choose private, friends, or public visibility.");
      return;
    }

    const timestamp = new Date().toISOString();
    // This is temporary preview data. The owner does not represent a login.
    const board: Board = {
      id: `preview-${crypto.randomUUID()}`,
      ownerId: "preview-user",
      title,
      description: readText("description"),
      visibility,
      isCompleted: formData.get("isCompleted") === "on",
      tags: splitList(readText("tags")),
      destinations: country
        ? [{ country, countryCode, ...(cities.length > 0 ? { cities } : {}) }]
        : [],
      items: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setPreview(board);
  }

  return (
    <>
      <form
        className="space-y-6"
        onSubmit={handleSubmit}
        onChange={() => {
          // Clear the previous result when inputs change so it cannot look current.
          setPreview(null);
          setError("");
        }}
      >
        <div>
          <label htmlFor="board-title">Title (required)</label>
          <input id="board-title" name="title" required className={inputClasses} />
        </div>

        <div>
          <label htmlFor="board-description">Description (optional)</label>
          <textarea id="board-description" name="description" rows={3} className={inputClasses} />
        </div>

        <fieldset className="space-y-4 rounded border border-line p-4">
          <legend className="px-2">Destination (optional)</legend>
          <p id="destination-help" className="text-14">
            Leave these fields blank for an undecided destination. This test form
            accepts one country and any number of cities.
          </p>
          <div>
            <label htmlFor="board-country">Country</label>
            <input id="board-country" name="country" aria-describedby="destination-help" className={inputClasses} />
          </div>
          <div>
            <label htmlFor="board-country-code">Country code</label>
            <input id="board-country-code" name="countryCode" aria-describedby="country-code-help" className={inputClasses} />
            <p id="country-code-help" className="mt-2 text-14">Two letters, for example SE for Sweden.</p>
          </div>
          <div>
            <label htmlFor="board-cities">Cities (optional)</label>
            <input id="board-cities" name="cities" aria-describedby="cities-help" className={inputClasses} />
            <p id="cities-help" className="mt-2 text-14">Separate cities with commas, for example Stockholm, Gothenburg.</p>
          </div>
        </fieldset>

        <div>
          <label htmlFor="board-visibility">Visibility</label>
          <select id="board-visibility" name="visibility" defaultValue="private" className={inputClasses}>
            <option value="private">Private (owner only)</option>
            <option value="friends">Friends</option>
            <option value="public">Public (anyone)</option>
          </select>
        </div>

        <label className="flex items-center gap-3">
          <input type="checkbox" name="isCompleted" className="size-5 accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground" />
          I have completed this trip
        </label>

        <div>
          <label htmlFor="board-tags">Tags (optional)</label>
          <input id="board-tags" name="tags" aria-describedby="tags-help" className={inputClasses} />
          <p id="tags-help" className="mt-2 text-14">Separate tags with commas, for example food, museums.</p>
        </div>

        {error ? <p role="alert" className="rounded border border-foreground p-3">{error}</p> : null}

        <button type="submit" className="rounded border border-foreground bg-foreground px-5 py-3 text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">
          Preview Board
        </button>
      </form>

      <section aria-labelledby="board-preview-heading" className="mt-10 border-t border-line pt-6">
        <h2 id="board-preview-heading" className="font-display text-24">Collected Board data</h2>
        <p role="status" className="mt-2 text-14">
          {preview
            ? "Preview ready. This Board exists only in memory and uses a test owner ID."
            : "Submit the form to see its current values here."}
        </p>
        {preview ? (
          <pre className="mt-4 whitespace-pre-wrap break-all rounded border border-line bg-faint p-4 text-14">
            <code>{JSON.stringify(preview, null, 2)}</code>
          </pre>
        ) : null}
      </section>
    </>
  );
}
