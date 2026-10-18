"use client";

import Link from "next/link";
import { useState } from "react";
import { collageBoardExamples, photoBoardExamples } from "@/data/board-card-examples";
import type { PhotoBoardCardData, PhotoBoardCardProps, PhotoBoardSave } from "@/types/board-card";
import PhotoBoardCard from "./PhotoBoardCard";

const tokyo = collageBoardExamples[0];
const detailedSample: PhotoBoardCardData = {
    ...tokyo,
    image: tokyo.images[0],
    tags: tokyo.themes
};
const fieldClass = "border-line bg-background text-foreground min-h-11 rounded-none border px-3 text-sm";

export default function PhotoBoardCardLab() {
    const [source, setSource] = useState("porto");
    const [width, setWidth] = useState(400);
    const [ownership, setOwnership] = useState<PhotoBoardCardProps["ownership"]>("other");
    const [visibility, setVisibility] = useState<PhotoBoardCardData["visibility"]>("public");
    const [status, setStatus] = useState<"draft" | "published">("published");
    const [saveState, setSaveState] = useState<PhotoBoardSave["state"]>("unsaved");
    const [scenario, setScenario] = useState("ready");
    const [reduced, setReduced] = useState(false);
    const [selected, setSelected] = useState(false);
    const original = source === "rich" ? detailedSample : photoBoardExamples[0];
    const board: PhotoBoardCardData = {
        ...original,
        title:
            source === "long"
                ? "Postcards from Porto and all the little places we found along the way"
                : original.title,
        titleLines: source === "long" ? undefined : original.titleLines,
        author:
            source === "long"
                ? "Inês Carvalho and a very long traveler name for the typography study"
                : original.author,
        image:
            source === "missing"
                ? undefined
                : source === "broken"
                  ? { src: "/missing-v4-cover.jpg", alt: "Unavailable sample cover" }
                  : original.image,
        destination: source === "missing" ? "" : original.destination,
        destinationLabel: source === "missing" ? "" : original.destinationLabel,
        status,
        visibility
    };
    return (
        <section
            id="v4-study"
            aria-labelledby="v4-study-heading"
            className="border-line mx-auto mt-12 max-w-[1480px] border-y py-10 sm:py-14"
        >
            <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(260px,420px)] lg:gap-20">
                <div className="max-w-xl">
                    <p className="text-muted-foreground text-xs tracking-[.16em] uppercase">V4 / Interaction study</p>
                    <h2
                        id="v4-study-heading"
                        className="font-display text-40 sm:text-60 mt-5 leading-none font-bold tracking-tight"
                    >
                        A photograph.
                        <br />A story beneath.
                    </h2>
                    <p className="text-muted-foreground mt-6 max-w-md text-sm leading-relaxed">
                        Hover, focus, or tap the card. The frame stays still while the photograph reveals its story.
                    </p>
                    <p className="text-muted-foreground mt-4 max-w-md text-xs leading-relaxed">
                        Visual fixtures and simulated control states only. Tokyo’s metadata and sample save count come
                        from its existing fixture. Porto has no supplied tags or save count; those fields are omitted.
                    </p>
                    <Link
                        href="/dev/boards"
                        className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                    >
                        Open real Boards and test account saving ↗
                    </Link>
                    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="grid gap-2 text-xs">
                            Content
                            <select
                                aria-label="V4 content"
                                value={source}
                                onChange={(event) => setSource(event.target.value)}
                                className={fieldClass}
                            >
                                <option value="porto">Porto / supplied metadata only</option>
                                <option value="rich">Tokyo / rich sample metadata</option>
                                <option value="long">Long title and author</option>
                                <option value="missing">No photograph or destination</option>
                                <option value="broken">Image load failure</option>
                            </select>
                        </label>
                        <label className="grid gap-2 text-xs">
                            Card width
                            <select
                                aria-label="V4 width"
                                value={width}
                                onChange={(event) => setWidth(Number(event.target.value))}
                                className={fieldClass}
                            >
                                {[240, 320, 400, 480].map((size) => (
                                    <option key={size} value={size}>
                                        {size}px
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="grid gap-2 text-xs">
                            Ownership
                            <select
                                aria-label="V4 ownership"
                                value={ownership}
                                onChange={(event) =>
                                    setOwnership(event.target.value as PhotoBoardCardProps["ownership"])
                                }
                                className={fieldClass}
                            >
                                <option value="other">Another traveler / control preview</option>
                                <option value="owner">Your Board</option>
                                <option value="unknown">Ownership unresolved</option>
                            </select>
                        </label>
                        <label className="grid gap-2 text-xs">
                            Visibility
                            <select
                                aria-label="V4 visibility"
                                value={visibility}
                                onChange={(event) =>
                                    setVisibility(event.target.value as PhotoBoardCardData["visibility"])
                                }
                                className={fieldClass}
                            >
                                <option value="public">Public</option>
                                <option value="friends">Friends</option>
                                <option value="collaborators">Restricted (backend: collaborators)</option>
                            </select>
                        </label>
                        <label className="grid gap-2 text-xs">
                            Publication
                            <select
                                aria-label="V4 publication"
                                value={status}
                                onChange={(event) => setStatus(event.target.value as typeof status)}
                                className={fieldClass}
                            >
                                <option value="published">Published</option>
                                <option value="draft">Draft / owner-only access</option>
                            </select>
                        </label>
                        <label className="grid gap-2 text-xs">
                            Bookmark state
                            <select
                                aria-label="V4 bookmark state"
                                value={saveState}
                                onChange={(event) => setSaveState(event.target.value as typeof saveState)}
                                className={fieldClass}
                            >
                                <option value="unsaved">Unsaved</option>
                                <option value="saved">Saved</option>
                                <option value="unknown">Unresolved</option>
                            </select>
                        </label>
                        <label className="grid gap-2 text-xs">
                            Request presentation
                            <select
                                aria-label="V4 request presentation"
                                value={scenario}
                                onChange={(event) => setScenario(event.target.value)}
                                className={fieldClass}
                            >
                                <option value="ready">Ready / local toggle</option>
                                <option value="pending">Pending</option>
                                <option value="error">Request failed</option>
                                <option value="signed-out">Sign in required</option>
                            </select>
                        </label>
                        <label className="flex min-h-11 items-center gap-3 text-sm">
                            <input
                                type="checkbox"
                                checked={reduced}
                                onChange={(event) => setReduced(event.target.checked)}
                                className="size-4"
                            />
                            Force reduced motion
                        </label>
                    </div>
                </div>
                <div id="v4-study-card" className="mx-auto w-full max-w-full min-w-0" style={{ width }}>
                    <PhotoBoardCard
                        key={`${source}:${ownership}:${width}`}
                        board={board}
                        details
                        ownership={ownership}
                        reduceMotion={reduced}
                        save={{
                            state: saveState,
                            pending: scenario === "pending",
                            onToggle: () => {
                                if (scenario === "ready") setSaveState(saveState === "saved" ? "unsaved" : "saved");
                            },
                            error:
                                scenario === "error"
                                    ? "Preview: request failed. The saved state is unchanged."
                                    : scenario === "signed-out"
                                      ? "Preview: sign in to save this Board."
                                      : undefined,
                            signInHref: scenario === "signed-out" ? "/login" : undefined
                        }}
                    />
                    <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
                        {width}px reference width · fits available space · local preview only
                    </p>
                    <button
                        type="button"
                        onClick={() => setSelected(!selected)}
                        className="border-line mt-5 min-h-11 border-b text-xs"
                    >
                        {selected ? "Selection action received" : "Independent parent selection action"}
                    </button>
                </div>
            </div>
        </section>
    );
}
