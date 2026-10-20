"use client";

import Link from "next/link";
import BackLink from "@/components/ui/BackLink";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import BoardPhoto from "@/components/features/boards/BoardPhoto";
import { destinationPhotoUrl, type DestinationGuideData } from "@/lib/destination-guides";
import { DestinationRail } from "./DestinationRail";
import { DestinationStories } from "./DestinationStories";
import DestinationPhotoCredit from "./DestinationPhotoCredit";
import DestinationPlaces from "./DestinationPlaces";

type Props = {
    destination: DestinationGuideData;
    onLoadMore?: () => void;
    onRetry?: () => void;
    loadingMore?: boolean;
    error?: string;
};

// The same layout renders every selected city; text, photos and Boards come from the API.
export function DestinationPage({ destination: guide, onLoadMore, onRetry, loadingMore = false, error = "" }: Props) {
    const reduced = useReducedMotion();
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
                    className="relative grid h-full w-[var(--destination-width)] shrink-0 snap-start snap-always grid-rows-[38%_minmax(0,1fr)] overflow-hidden outline-none md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:grid-rows-1"
                >
                    <div className="border-line @container relative isolate h-full min-w-0 overflow-hidden border-r">
                        <BackLink
                            fallbackHref="/discover"
                            className="bg-background/90 absolute top-5 left-5 z-20 px-2 md:left-8"
                        />
                        <motion.div
                            initial={{ opacity: 0.35, rotate: -35 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            transition={{ duration: reduced ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute top-1/2 right-0 aspect-square w-[200%] -translate-y-1/2 overflow-hidden rounded-full"
                        >
                            <BoardPhoto
                                image={photos[0]}
                                placeholderLabel={destination.name}
                                preload
                                sizes="(max-width: 767px) 680px, 1100px"
                                className="h-full w-full"
                            />
                            <span aria-hidden="true" className="bg-background absolute inset-[19%] rounded-full" />
                        </motion.div>
                        {/* Match the white cutout's circle so lettering can never cover the photograph. */}
                        <div className="pointer-events-none absolute inset-0 [clip-path:circle(62cqw_at_0_50%)]">
                            <div className="absolute top-1/2 right-[45%] left-5 -translate-y-1/2 md:left-8">
                                <p className="mb-2 text-xs tracking-widest uppercase">{destination.country}</p>
                                <h1
                                    style={{
                                        fontSize: `clamp(1rem, ${Math.min(12, 90 / destination.name.length)}cqw, 6rem)`
                                    }}
                                    className="font-display leading-[0.9] font-bold tracking-[-0.065em] break-words uppercase"
                                >
                                    {destination.name}
                                </h1>
                            </div>
                        </div>
                        <div className="bg-background/90 absolute right-5 bottom-7 left-5 w-fit max-w-[85%] px-2 py-1 md:left-8">
                            <DestinationPhotoCredit {...guide.images[0]} />
                            {!guide.images[0] ? (
                                <p className="text-muted-foreground text-xs">
                                    Photo unavailable for {destination.name}
                                </p>
                            ) : null}
                        </div>
                    </div>
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
                                        : `No matching Wikivoyage introduction is available for ${destination.name}.`}
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
                                Explore places on the map <ArrowUpRight size={18} />
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
                    className="bg-background border-line relative isolate h-full w-[var(--destination-width)] shrink-0 snap-start snap-always overflow-hidden border-l outline-none lg:[--create-photo-width:max(640px,48vw)]"
                >
                    <span
                        aria-hidden="true"
                        className="after:bg-background pointer-events-none absolute inset-y-0 left-0 hidden w-[clamp(6rem,14vw,14rem)] overflow-hidden bg-[var(--atlas-background)] after:absolute after:top-1/2 after:left-5 after:aspect-[1077/1254] after:w-[var(--create-photo-width)] after:-translate-y-1/2 after:rounded-[50%] lg:block"
                    />
                    {/* Equal space above and below keeps the creator button in the middle of the closing panel. */}
                    <div className="relative z-10 grid h-full grid-rows-[1fr_auto_1fr] px-6 py-[5dvh] lg:w-[66%] lg:pr-0 lg:pl-[clamp(7rem,12vw,12rem)]">
                        <h2
                            id="destination-create-heading"
                            className="font-display self-end pb-8 text-[clamp(2.5rem,min(7vw,11dvh),7rem)] leading-[1.02] font-bold tracking-[-0.055em]"
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
                        <div className="self-end pt-6">
                            <p className="text-muted-foreground mt-2 max-w-[30ch] text-sm leading-[1.3]">
                                Build your own itinerary, starting with the places you want to visit.
                            </p>
                        </div>
                    </div>
                    <div className="pointer-events-none absolute top-1/2 left-[78%] aspect-[1077/1254] w-[100%] -translate-y-1/2 overflow-hidden rounded-[50%] lg:absolute lg:top-1/2 lg:left-[62%] lg:z-20 lg:mt-0 lg:ml-0 lg:w-[var(--create-photo-width)] lg:-translate-y-1/2">
                        <BoardPhoto
                            image={photos[1]}
                            placeholderLabel={destination.name}
                            className="absolute! inset-[-8%]"
                            sizes="(max-width: 1023px) 125vw, 100vw"
                        />
                    </div>
                    <div className="bg-background/90 absolute right-4 bottom-4 z-30 ml-6 w-fit px-2">
                        <DestinationPhotoCredit {...guide.images[1]} />
                    </div>
                </section>
            </DestinationRail>
        </MotionConfig>
    );
}
