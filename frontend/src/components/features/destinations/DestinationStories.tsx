"use client";

import SpatialGallery from "../boards/SpatialGallery";
import ViewAllBoards from "../boards/ViewAllBoards";
import { collectionHref } from "@/lib/board-collections";
import type { GalleryBoard } from "@/lib/my-boards";
import type { PhotoBoardCardData } from "@/types/board-card";
import { destinationPhotoUrl, type DestinationBoardSummary } from "@/lib/destination-guides";

type Props = {
    kind?: "country";
    name: string;
    countryCode: string;
    latitude?: number;
    longitude?: number;
    boards: DestinationBoardSummary[];
    hasMore?: boolean;
    onLoadMore?: () => void;
    loadingMore?: boolean;
    error?: string;
    onRetry?: () => void;
};

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Requests, pagination and retries remain owned by the destination guide hook.
export function DestinationStories({
    kind,
    name,
    countryCode,
    latitude,
    longitude,
    boards,
    loadingMore,
    error,
    onRetry
}: Props) {
    const preview: GalleryBoard[] = boards.slice(0, 10).map((item) => {
        const image = item.images[0];
        const photo: PhotoBoardCardData = {
            id: String(item.boardId),
            title: item.title,
            author: item.username,
            destination: name,
            destinationLabel: countryCode,
            description: item.description ?? undefined,
            tags: item.tags,
            durationDays: item.durationDays,
            status: "published",
            visibility: "public",
            image: image
                ? {
                      src: destinationPhotoUrl(new URL(image.url, apiOrigin).toString(), 1200),
                      alt: image.alt || item.title,
                      unoptimized: true
                  }
                : undefined
        };
        return {
            photo,
            compact: { ...photo, image: photo.image ?? { src: "", alt: "" } },
            collage: {
                ...photo,
                images: photo.image ? [photo.image] : [],
                durationDays: item.durationDays,
                description: item.description ?? "",
                themes: item.tags,
                highlights: []
            },
            href: `/boards/${item.boardId}`
        };
    });
    const viewAllHref = collectionHref("destination", {
        country: countryCode,
        ...(kind === "country" || latitude === undefined || longitude === undefined
            ? {}
            : { latitude: String(latitude), longitude: String(longitude) }),
        sort: "updated-desc"
    });

    return (
        <section
            id="destination-boards"
            data-destination-chapter
            tabIndex={-1}
            aria-labelledby="destination-boards-heading"
            className="relative flex h-full w-[var(--destination-width)] shrink-0 snap-start snap-always flex-col overflow-y-auto bg-[var(--atlas-background)] px-6 py-7 text-[var(--atlas-foreground)] outline-none [--line:var(--atlas-line)] [--muted-foreground:var(--atlas-muted)] md:flex-row md:gap-8 md:px-14 md:py-12"
        >
            <div className="md:border-line relative z-10 flex shrink-0 flex-col justify-center md:w-[27%] md:border-r md:pr-8">
                <p className="text-muted-foreground text-[10px] tracking-[0.2em] uppercase">Public boards</p>
                <h2
                    id="destination-boards-heading"
                    className="font-display mt-5 text-[clamp(2.7rem,min(4vw,8dvh),4.75rem)] leading-[0.95] tracking-[-0.055em] [overflow-wrap:anywhere]"
                >
                    Boards {kind === "country" ? "across" : "in and around"} {name}
                </h2>
                <p className="text-muted-foreground mt-6 max-w-60 text-xs leading-6">
                    Trips shared by travellers with activities {kind === "country" ? "in" : "near"} {name}. Newest
                    updated first.
                </p>
                <div className="mt-4">
                    <ViewAllBoards href={viewAllHref} />
                </div>
                <div aria-live="polite" className="mt-4">
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
                    ) : null}
                </div>
            </div>
            {!preview.length ? (
                <p role="status" className="text-muted-foreground py-16 text-sm">
                    {loadingMore
                        ? "Loading boards..."
                        : error
                          ? "Public boards are unavailable right now."
                          : `No public Boards ${kind === "country" ? "across" : "in and around"} ${name} yet.`}
                </p>
            ) : (
                <div className="mt-7 min-w-0 flex-1 self-center md:mt-0">
                    <SpatialGallery boards={preview} ariaLabel={`${name} public Boards`} embedded resolveDetails />
                </div>
            )}
        </section>
    );
}
