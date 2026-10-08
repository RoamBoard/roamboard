"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { Board, BoardVisibility } from "@/types/board";
import VisibilitySelector from "./VisibilitySelector";
import VibeSelector from "./VibeSelector";
import PillTagInput from "./PillTagInput";
import CollaboratorInput from "./CollaboratorInput";

const inputClasses =
    "mt-2 w-full rounded-[2px] border border-line bg-background px-3 py-2 text-obsidian focus-visible:outline-1 focus-visible:outline-obsidian";

function splitList(value: string): string[] {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

const DEFAULT_TAGS = ["tokyo", "japan", "itinerary", "food", "city"];
const DEFAULT_VIBES = ["Nature", "Romantic", "Hidden Gems"];
const DEFAULT_HIGHLIGHTS = [
    "Senso-ji",
    "Shibuya Crossing",
    "Omoide Yokocho",
    "Meiji Shrine Torii",
    "Tsukiji Market",
    "Golden Gai"
];

export default function BoardPreviewForm() {
    const [preview, setPreview] = useState<Board | null>(null);
    const [error, setError] = useState("");

    // Designer spec variables
    const [tags, setTags] = useState<string[]>(DEFAULT_TAGS);
    const [vibes, setVibes] = useState<string[]>(DEFAULT_VIBES);
    const [highlights, setHighlights] = useState<string[]>(DEFAULT_HIGHLIGHTS);
    const [visibility, setVisibility] = useState<BoardVisibility>("private");
    const [collaborators, setCollaborators] = useState<string[]>([]);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const readText = (name: string) =>
            String(formData.get(name) ?? "").trim();
        const title = readText("title");
        const country = readText("country");
        const countryCode = readText("countryCode").toUpperCase();
        const cities = splitList(readText("cities"));

        setPreview(null);
        setError("");

        if (!title) {
            setError("Enter a Board title containing more than spaces.");
            return;
        }

        if (
            (country || countryCode || cities.length > 0) &&
            (!country || !countryCode)
        ) {
            setError(
                "To add a destination, enter both its country and two-letter country code."
            );
            return;
        }

        if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
            setError("Use a two-letter country code, such as SE for Sweden or JP for Japan.");
            return;
        }

        const timestamp = new Date().toISOString();
        const board: Board = {
            id: `preview-${crypto.randomUUID()}`,
            ownerId: "preview-user",
            title,
            description: readText("description"),
            visibility,
            isCompleted: formData.get("isCompleted") === "on",
            tags,
            vibes,
            highlights,
            collaborators,
            destinations: country
                ? [
                      {
                          country,
                          countryCode,
                          ...(cities.length > 0 ? { cities } : {})
                      }
                  ]
                : [],
            items: [],
            createdAt: timestamp,
            updatedAt: timestamp
        };

        setPreview(board);
    }

    function handleResetForm() {
        setTags(DEFAULT_TAGS);
        setVibes(DEFAULT_VIBES);
        setHighlights(DEFAULT_HIGHLIGHTS);
        setVisibility("private");
        setCollaborators([]);
        setPreview(null);
        setError("");
    }

    return (
        <>
            <form
                className="space-y-7"
                onSubmit={handleSubmit}
                onChange={() => {
                    setPreview(null);
                    setError("");
                }}
            >
                {/* Board Basics */}
                <div className="space-y-4">
                    <div>
                        <label
                            htmlFor="board-title"
                            className="text-11 tracking-label text-graphite font-bold uppercase"
                        >
                            Title (required)
                        </label>
                        <input
                            id="board-title"
                            name="title"
                            required
                            defaultValue="A weekend in Tokyo"
                            placeholder="e.g. A weekend in Tokyo"
                            className={inputClasses}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="board-description"
                            className="text-11 tracking-label text-graphite font-bold uppercase"
                        >
                            Description (optional)
                        </label>
                        <textarea
                            id="board-description"
                            name="description"
                            rows={3}
                            defaultValue="Two days for food, walks, and time to explore Asakusa."
                            placeholder="Write an overview of this journey..."
                            className={inputClasses}
                        />
                    </div>
                </div>

                {/* Destination */}
                <fieldset className="border-line space-y-4 rounded-[2px] border p-4.5">
                    <legend className="text-11 tracking-label text-graphite px-2 font-bold uppercase">
                        Destination (optional)
                    </legend>
                    <p id="destination-help" className="text-12 text-stone">
                        Leave these fields blank for an undecided destination.
                        Accepts one country and any number of cities.
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label
                                htmlFor="board-country"
                                className="text-11 tracking-label text-graphite font-bold uppercase"
                            >
                                Country
                            </label>
                            <input
                                id="board-country"
                                name="country"
                                defaultValue="Japan"
                                aria-describedby="destination-help"
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="board-country-code"
                                className="text-11 tracking-label text-graphite font-bold uppercase"
                            >
                                Country code
                            </label>
                            <input
                                id="board-country-code"
                                name="countryCode"
                                defaultValue="JP"
                                aria-describedby="country-code-help"
                                className={inputClasses}
                            />
                            <p id="country-code-help" className="text-11 text-stone mt-1">
                                Two letters, for example JP for Japan.
                            </p>
                        </div>
                    </div>
                    <div>
                        <label
                            htmlFor="board-cities"
                            className="text-11 tracking-label text-graphite font-bold uppercase"
                        >
                            Cities (optional)
                        </label>
                        <input
                            id="board-cities"
                            name="cities"
                            defaultValue="Tokyo"
                            aria-describedby="cities-help"
                            className={inputClasses}
                        />
                        <p id="cities-help" className="text-11 text-stone mt-1">
                            Separate cities with commas, for example Tokyo, Kyoto.
                        </p>
                    </div>
                </fieldset>

                {/* DESIGNER COMPONENTS: Board Card Variables */}
                <div className="border-line space-y-6 rounded-[2px] border p-5">
                    <div className="border-line border-b pb-3">
                        <span className="text-10 tracking-label text-graphite font-bold uppercase">
                            Project Components 2
                        </span>
                        <h3 className="font-display text-20 text-obsidian font-bold tracking-tight">
                            Board Card Variables
                        </h3>
                    </div>

                    {/* 1. Tags (optional) */}
                    <PillTagInput
                        label="Tags"
                        tags={tags}
                        onChange={setTags}
                        name="tags"
                        addButtonLabel="add tag +"
                        placeholder="new tag..."
                        formatTag={(t) => t.toLowerCase().trim()}
                        tooltip="Categorize this board with short tags"
                    />

                    {/* 2. Vibe (up to 5) */}
                    <VibeSelector
                        selectedVibes={vibes}
                        onChange={setVibes}
                        maxVibes={5}
                    />

                    {/* 3. Highlights (optional) */}
                    <PillTagInput
                        label="Highlights"
                        tags={highlights}
                        onChange={setHighlights}
                        name="highlights"
                        addButtonLabel="add highlight +"
                        placeholder="highlight spot..."
                        tooltip="Key locations, stops, or experiences for this board"
                    />

                    {/* 4. Visibility */}
                    <VisibilitySelector
                        value={visibility}
                        onChange={setVisibility}
                        name="visibility"
                    />

                    {/* 5. Collaborators (optional) */}
                    <CollaboratorInput
                        collaborators={collaborators}
                        onChange={setCollaborators}
                    />
                </div>

                <label className="text-13 text-obsidian flex cursor-pointer items-center gap-3 font-medium">
                    <input
                        type="checkbox"
                        name="isCompleted"
                        className="accent-obsidian size-4 rounded"
                    />
                    I have completed this trip
                </label>

                {error ? (
                    <p
                        role="alert"
                        className="border-obsidian bg-porcelain text-13 text-obsidian rounded-[2px] border p-3 font-medium"
                    >
                        {error}
                    </p>
                ) : null}

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        className="border-obsidian bg-obsidian text-background hover:bg-obsidian/90 cursor-pointer rounded-[2px] border px-6 py-2.5 text-12 font-bold tracking-wider uppercase transition-colors"
                    >
                        Preview Board
                    </button>
                    <button
                        type="button"
                        onClick={handleResetForm}
                        className="border-line text-graphite hover:text-obsidian hover:border-obsidian cursor-pointer rounded-[2px] border px-4 py-2.5 text-12 font-medium transition-colors"
                    >
                        Reset Variables
                    </button>
                </div>
            </form>

            <section
                aria-labelledby="board-preview-heading"
                className="border-line mt-10 border-t pt-6"
            >
                <div className="flex items-center justify-between">
                    <h2 id="board-preview-heading" className="font-display text-20 text-obsidian font-bold">
                        Collected Board Data
                    </h2>
                    {preview && (
                        <span className="text-10 tracking-label text-graphite font-bold uppercase">
                            JSON Output
                        </span>
                    )}
                </div>
                <p role="status" className="text-12 text-stone mt-1">
                    {preview
                        ? "Preview generated with designer variables. Exists in memory."
                        : "Submit the form to preview the collected Board data."}
                </p>
                {preview ? (
                    <pre className="border-line bg-porcelain/40 text-12 text-obsidian mt-4 rounded-[2px] border p-4 break-all whitespace-pre-wrap font-mono">
                        <code>{JSON.stringify(preview, null, 2)}</code>
                    </pre>
                ) : null}
            </section>
        </>
    );
}
