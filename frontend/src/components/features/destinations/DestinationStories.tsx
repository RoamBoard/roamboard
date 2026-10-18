"use client";

import { motion, useReducedMotion } from "motion/react";
import { destinationPhotoUrl, type DestinationBoardSummary } from "@/lib/destination-guides";
import PhotoBoardCard from "@/components/features/boards/cards/PhotoBoardCard";
import DestinationPhotoCredit from "./DestinationPhotoCredit";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Props = {
    name: string;
    countryCode: string;
    boards: DestinationBoardSummary[];
    hasMore?: boolean;
    onLoadMore?: () => void;
    loadingMore?: boolean;
    error?: string;
    onRetry?: () => void;
};

// Reuse Discover's photo cards; the page hook owns requests, pagination and retries.
export function DestinationStories({
    name,
    countryCode,
    boards,
    hasMore,
    onLoadMore,
    loadingMore,
    error,
    onRetry
}: Props) {
    const reduced = useReducedMotion();
    return (
        <section
            id="destination-boards"
            data-destination-chapter
            tabIndex={-1}
            aria-labelledby="destination-boards-heading"
            className="relative flex h-full w-[var(--destination-width)] shrink-0 snap-start snap-always flex-col overflow-hidden bg-[var(--atlas-background)] px-6 py-6 text-[var(--atlas-foreground)] outline-none [--faint:var(--atlas-line)] [--muted-foreground:var(--atlas-muted)] md:px-14 [@media(max-height:540px)]:py-3"
        >
            <div className="flex items-end justify-between gap-6 border-b border-[var(--atlas-line)] pb-5 [@media(max-height:540px)]:pb-3">
                <div className="max-w-2xl">
                    <p className="text-muted-foreground text-[10px] tracking-[0.2em] uppercase [@media(max-height:540px)]:hidden">
                        Public boards
                    </p>
                    <h2
                        id="destination-boards-heading"
                        className="font-display mt-3 text-[clamp(2rem,5dvh,4rem)] leading-[0.95] tracking-[-0.055em] [@media(max-height:540px)]:mt-0 [@media(max-height:540px)]:text-2xl"
                    >
                        Boards in and around {name}
                    </h2>
                </div>
                <p className="text-muted-foreground hidden max-w-60 text-xs leading-6 md:block [@media(max-height:540px)]:hidden">
                    Trips shared by travellers with activities near {name}. Newest updated first.
                </p>
            </div>
            {!boards.length ? (
                <p role="status" className="text-muted-foreground py-16 text-sm">
                    {error ? "Public boards are unavailable right now." : `No public Boards in and around ${name} yet.`}
                </p>
            ) : (
                <ol
                    aria-label={`${name} public Boards`}
                    data-destination-scroll
                    tabIndex={0}
                    className="mt-6 flex min-h-0 flex-1 [scrollbar-width:none] items-start gap-8 overflow-x-auto overflow-y-hidden focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-scrollbar]:hidden [@media(max-height:540px)]:mt-3"
                >
                    {boards.map((summary) => {
                        // The API puts the chosen cover first; an empty URL uses the shared named placeholder.
                        const cover = summary.images[0];
                        const board = {
                            id: String(summary.boardId),
                            title: summary.title,
                            author: summary.username,
                            destination: name,
                            destinationLabel: countryCode,
                            image: {
                                src: cover ? destinationPhotoUrl(new URL(cover.url, apiOrigin).toString(), 1200) : "",
                                alt: cover?.alt || summary.title,
                                unoptimized: true
                            }
                        };
                        return (
                            <li
                                key={summary.boardId}
                                className="w-[clamp(160px,30dvh,300px)] shrink-0 [@media(max-height:540px)]:w-30"
                            >
                                <motion.div
                                    initial={false}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.08 }}
                                    style={reduced ? undefined : { opacity: 0.65, y: 12 }}
                                    transition={{ duration: reduced ? 0 : 0.5 }}
                                    className="motion-reduce:transform-none! motion-reduce:opacity-100! [&_a]:focus-visible:outline-white"
                                >
                                    <PhotoBoardCard board={board} href={`/boards/${summary.boardId}`} />
                                </motion.div>
                                <p className="text-muted-foreground mt-3 text-xs">
                                    {summary.durationDays} days / {name}
                                </p>
                                {cover ? <DestinationPhotoCredit {...cover} /> : null}
                            </li>
                        );
                    })}
                </ol>
            )}
            <div aria-live="polite" className="mt-4 shrink-0">
                {error ? (
                    <div role="alert" className="text-sm">
                        <p>{error}</p>
                        <button
                            type="button"
                            onClick={onRetry}
                            disabled={loadingMore}
                            className="mt-2 min-h-11 underline underline-offset-4 disabled:opacity-50"
                        >
                            Retry public boards
                        </button>
                    </div>
                ) : hasMore ? (
                    <button
                        type="button"
                        onClick={onLoadMore}
                        disabled={loadingMore}
                        className="min-h-11 border border-[var(--atlas-line)] px-5 text-xs disabled:opacity-50"
                    >
                        {loadingMore ? "Loading boards..." : "Load more boards"}
                    </button>
                ) : null}
            </div>
        </section>
    );
}
