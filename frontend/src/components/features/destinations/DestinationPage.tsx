"use client";

import Link from "next/link";
import { MotionConfig } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import BoardPhoto from "@/components/features/boards/BoardPhoto";
import { destinationPhotoUrl, type DestinationGuideData } from "@/lib/destination-guides";
import { DestinationRail } from "./DestinationRail";
import { DestinationStories } from "./DestinationStories";
import DestinationPhotoCredit from "./DestinationPhotoCredit";
import DestinationPlaces from "./DestinationPlaces";
import DestinationArtwork from "./DestinationArtwork";

type Props = {
    destination: DestinationGuideData;
    onLoadMore?: () => void;
    onRetry?: () => void;
    loadingMore?: boolean;
    error?: string;
};

// The same layout renders every selected city; text, photos and Boards come from the API.
export function DestinationPage({ destination: guide, onLoadMore, onRetry, loadingMore = false, error = "" }: Props) {
    const { destination, article } = guide;
    const photos = guide.images.map((photo) => ({
        ...photo,
        url: destinationPhotoUrl(photo.url),
        source: "application" as const
    }));
    const tags = Array.from(new Set(guide.boards.flatMap((board) => board.tags)));
    const cityTip = guide.cityTip ? (
        <>
            <p className="text-muted-foreground mt-2 text-sm leading-6 md:line-clamp-3">{guide.cityTip.text}</p>
            <a
                href={guide.cityTip.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground mt-2 inline-block text-xs underline"
            >
                Wikivoyage contributors / CC BY-SA 4.0
            </a>
        </>
    ) : null;
    return (
        <MotionConfig reducedMotion="user">
            <DestinationRail name={destination.name}>
                <header
                    role="region"
                    id="guide"
                    data-destination-chapter
                    tabIndex={-1}
                    aria-label={`${destination.name} introduction`}
                    className="relative grid h-full w-[var(--destination-width)] shrink-0 snap-start snap-always grid-rows-[minmax(10rem,38%)_minmax(0,1fr)] overflow-hidden outline-none md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:grid-rows-1"
                >
                    <DestinationArtwork name={destination.name} country={destination.country} image={guide.images[0]} />
                    <div
                        id="destination-information"
                        tabIndex={-1}
                        className="border-line flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overscroll-y-contain border-x outline-none"
                    >
                        <section
                            aria-labelledby="destination-about-heading"
                            className="border-line flex shrink-0 grow flex-col justify-center px-6 py-5 md:px-10 md:py-8 [@media(max-height:540px)]:py-3"
                        >
                            <h2
                                id="destination-about-heading"
                                className="font-display text-[clamp(1.25rem,4dvh,3.5rem)] leading-tight"
                            >
                                About {destination.name}
                            </h2>
                            {article ? (
                                <>
                                    <p className="text-muted-foreground mt-3 line-clamp-4 shrink-0 text-sm leading-6 md:line-clamp-none md:text-[clamp(0.875rem,1.8dvh,1rem)] md:leading-[1.6]">
                                        {article.description}
                                    </p>
                                    <p className="text-muted-foreground mt-2 text-[10px] leading-4 md:text-xs">
                                        <a
                                            href={article.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="underline underline-offset-4"
                                        >
                                            Read more on Wikivoyage
                                        </a>{" "}
                                        (Wikivoyage contributors,{" "}
                                        <a
                                            href="https://creativecommons.org/licenses/by-sa/4.0/"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="underline underline-offset-4"
                                        >
                                            CC BY-SA 4.0
                                        </a>
                                        ).
                                    </p>
                                </>
                            ) : (
                                <p className="text-muted-foreground mt-3 text-sm leading-7">
                                    {guide.unavailable.includes("description")
                                        ? "The introduction could not be loaded right now."
                                        : `No introduction is available for ${destination.name}.`}
                                </p>
                            )}
                            {guide.cityTip ? (
                                <>
                                    <details className="border-line mt-4 border-t md:hidden">
                                        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">
                                            {guide.cityTip.title}
                                        </summary>
                                        <div className="pb-3">{cityTip}</div>
                                    </details>
                                    <div className="border-line mt-5 hidden border-t pt-4 md:block">
                                        <h3 className="text-sm font-semibold">{guide.cityTip.title}</h3>
                                        {cityTip}
                                    </div>
                                </>
                            ) : null}
                            {guide.unavailable.includes("cityTip") ? (
                                <p className="text-muted-foreground mt-3 text-xs" role="status">
                                    The getting-around tip could not load.
                                </p>
                            ) : null}
                            {guide.unavailable.some(
                                (source) => source === "description" || source === "images" || source === "cityTip"
                            ) ? (
                                <div className="text-muted-foreground mt-5 text-xs" role="status">
                                    {guide.unavailable.includes("images") ? (
                                        <p>Destination photos could not be loaded right now.</p>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={onRetry}
                                        disabled={loadingMore}
                                        className="mt-3 min-h-11 underline underline-offset-4 disabled:opacity-50"
                                    >
                                        Retry destination information
                                    </button>
                                </div>
                            ) : null}
                            <a
                                href="#destination-places"
                                className="mt-3 flex min-h-11 items-center gap-4 text-sm underline underline-offset-4"
                            >
                                Explore {destination.kind === "country" ? "cities" : "places"} on the map{" "}
                                <ArrowUpRight size={18} />
                            </a>
                        </section>
                        <section
                            aria-labelledby="destination-tags-heading"
                            className="border-line hidden shrink-0 border-t px-6 py-5 md:block md:px-10 [@media(max-height:540px)]:hidden"
                        >
                            <h2 id="destination-tags-heading" className="text-lg font-bold">
                                Tags from public boards
                            </h2>
                            {tags.length ? (
                                <ul className="text-muted-foreground mt-3 flex gap-6 overflow-x-auto text-xs whitespace-nowrap">
                                    {tags.map((tag) => (
                                        <li key={tag} className="underline underline-offset-4">
                                            {tag}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground mt-3 text-xs">
                                    No public board tags are available yet.
                                </p>
                            )}
                        </section>
                    </div>
                </header>
                <DestinationPlaces guide={guide} onRetry={onRetry} loading={loadingMore} />
                <DestinationStories
                    kind={destination.kind}
                    name={destination.name}
                    countryCode={destination.countryCode}
                    boards={guide.boards}
                    hasMore={guide.hasMore}
                    onLoadMore={onLoadMore}
                    loadingMore={loadingMore}
                    error={
                        error ||
                        (guide.unavailable.includes("boards") ? "Public Boards could not be loaded right now." : "")
                    }
                    onRetry={onRetry}
                />
                <section
                    id="destination-create"
                    data-destination-chapter
                    tabIndex={-1}
                    aria-labelledby="destination-create-heading"
                    className="bg-background border-line relative isolate h-full w-[var(--destination-width)] shrink-0 snap-start snap-always overflow-y-auto overscroll-y-contain border-l outline-none lg:[--create-photo-width:max(640px,48vw,100dvh)]"
                >
                    <span
                        aria-hidden="true"
                        className="after:bg-background pointer-events-none absolute inset-y-0 left-0 hidden w-[min(28%,32dvh)] overflow-hidden bg-[var(--atlas-background)] after:absolute after:top-1/2 after:left-5 after:aspect-[1077/1254] after:w-[var(--create-photo-width)] after:-translate-y-1/2 after:rounded-[50%] lg:block"
                    />
                    {/* Equal space above and below keeps the creator button in the middle of the closing panel. */}
                    <div className="relative z-10 grid min-h-full grid-rows-[1fr_auto_1fr] px-6 py-[5dvh] max-md:pb-12 lg:w-[63%] lg:pr-0 lg:pl-[clamp(7rem,12vw,12rem)]">
                        <h2
                            id="destination-create-heading"
                            className="font-display max-w-[calc(100%_-_1.5rem)] self-end pb-8 text-[clamp(2.5rem,min(7vw,11dvh),7rem)] leading-[1.02] font-bold tracking-[-0.055em] [overflow-wrap:anywhere] lg:max-w-none lg:text-[clamp(2.5rem,4.8vw,7rem)]"
                        >
                            Start a {destination.name} board
                        </h2>
                        <Link
                            href="/boards/new"
                            className="group bg-foreground text-background hover:bg-foreground/85 flex min-h-16 items-center gap-5 px-5 py-5 text-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none lg:min-h-24 lg:w-[calc(100%+12rem)] lg:px-9 lg:text-[clamp(1.5rem,2.5vw,2.75rem)] md:[@media(max-height:800px)]:min-h-12"
                        >
                            <span>Start planning</span>
                            <ArrowUpRight
                                size={28}
                                strokeWidth={1}
                                className="shrink-0 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none"
                            />
                        </Link>
                        <div className="self-end pt-6 lg:pb-4">
                            <p className="text-muted-foreground mt-2 max-w-[30ch] text-sm leading-[1.3]">
                                Build your own itinerary, starting with the places you want to visit.
                            </p>
                            <div className="bg-background/90 mt-4 w-fit px-2 md:hidden">
                                <DestinationPhotoCredit {...guide.images[1]} />
                            </div>
                        </div>
                    </div>
                    <div className="pointer-events-none absolute inset-0 overflow-hidden lg:z-20">
                        <div className="absolute top-1/2 left-[78%] aspect-[1077/1254] w-full -translate-y-1/2 overflow-hidden rounded-[50%] lg:left-[63%] lg:w-[var(--create-photo-width)]">
                            <BoardPhoto
                                image={photos[1]}
                                placeholderLabel={destination.name}
                                className="absolute! inset-[-8%]"
                                sizes="(max-width: 1023px) 125vw, 100vw"
                            />
                        </div>
                    </div>
                    <div className="bg-background/90 absolute right-4 bottom-4 z-30 ml-6 hidden w-fit px-2 md:block">
                        <DestinationPhotoCredit {...guide.images[1]} />
                    </div>
                </section>
            </DestinationRail>
        </MotionConfig>
    );
}
