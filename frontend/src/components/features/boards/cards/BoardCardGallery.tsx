"use client";

import { useState } from "react";
import Link from "next/link";
import BoardCard, { type BoardCardProps } from "./BoardCard";
import ThemeSelect from "@/components/ui/ThemeSelect";
import {
    collageBoardExamples,
    compactBoardExamples,
    landscapeBoardExamples,
    photoBoardExamples
} from "@/data/board-card-examples";

const groups = [
    { name: "V1 · Collage", variant: "collage", boards: collageBoardExamples, width: 440, height: 560 },
    { name: "V2 · Compact vertical", variant: "compact", boards: compactBoardExamples, width: 180, height: 340 },
    { name: "V3 · Landscape", variant: "landscape", boards: landscapeBoardExamples, width: 700, height: 400 },
    { name: "V4 · Full photo", variant: "photo", boards: photoBoardExamples, width: 400, height: 500 }
] as const;

export default function BoardCardGallery() {
    const [fit, setFit] = useState(false);
    const [saved, setSaved] = useState<Record<string, boolean>>({});
    const [feedback, setFeedback] = useState("");

    return (
        <main className="bg-background text-foreground min-h-dvh p-5 sm:p-10">
            <header className="mx-auto max-w-[1480px]">
                <div className="flex items-center justify-between gap-5">
                    <Link href="/dev" className="text-14 underline underline-offset-4">
                        Development routes
                    </Link>
                    <ThemeSelect />
                </div>
                <h1 className="font-display text-36 mt-8 font-bold">Collapsed Board components</h1>
                <p className="text-muted-foreground text-14 mt-3 max-w-2xl">
                    All twelve visual fixtures from Figma Project Components. Bookmarks on this page are a local
                    interaction demo.
                </p>
                <div className="mt-6 flex gap-3" role="group" aria-label="Card sizing">
                    {[false, true].map((value) => (
                        <button
                            key={String(value)}
                            type="button"
                            aria-pressed={fit === value}
                            onClick={() => setFit(value)}
                            className="border-line aria-pressed:bg-foreground aria-pressed:text-background min-h-11 border px-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                        >
                            {value ? "Fit available width" : "Figma reference sizes"}
                        </button>
                    ))}
                </div>
                <p role="status" className="text-muted-foreground text-12 mt-3 min-h-5">
                    {feedback}
                </p>
            </header>
            {groups.map((group) => (
                <section key={group.variant} aria-label={group.name} className="mx-auto mt-12 max-w-[1480px]">
                    <h2 className="font-display text-24 border-line mb-8 border-b pb-4 font-bold">{group.name}</h2>
                    <div className="flex flex-wrap items-start gap-10 overflow-x-auto pb-5">
                        {group.boards.map((board) => {
                            const width =
                                "referenceWidth" in board ? (board.referenceWidth ?? group.width) : group.width;
                            const bookmarked =
                                saved[board.id] ?? (group.variant === "collage" || group.variant === "compact");
                            const props = { variant: group.variant, board } as BoardCardProps;
                            return (
                                <figure
                                    id={board.id}
                                    key={board.id}
                                    className="shrink-0 scroll-mt-5"
                                    style={{ width: fit ? `min(100%, ${width}px)` : width }}
                                >
                                    <figcaption className="text-muted-foreground text-12 mb-4">
                                        {board.destination} · {width} × {group.height}
                                    </figcaption>
                                    <div data-card-example={board.id}>
                                        <BoardCard
                                            {...props}
                                            bookmarked={bookmarked}
                                            onBookmark={() => {
                                                setSaved((current) => ({ ...current, [board.id]: !bookmarked }));
                                                setFeedback(
                                                    `${board.title}: ${bookmarked ? "removed from" : "added to"} preview bookmarks.`
                                                );
                                            }}
                                        />
                                    </div>
                                </figure>
                            );
                        })}
                    </div>
                </section>
            ))}
        </main>
    );
}
