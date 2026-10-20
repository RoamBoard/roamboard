import { LibraryCredit } from "@/components/images/LibraryImage";
import DiscoverPhoto from "./DiscoverPhoto";
import VibeGrid from "./VibeGrid";
import DiscoverSearch from "./DiscoverSearch";
import DiscoverMoodMarquees from "./DiscoverMoodMarquees";
import FeaturedBoards from "./FeaturedBoards";
import RoamFlow from "./roamflow/RoamFlow";
import { roamFlowInitialPage } from "@/data/roamflow-boards";
import { Marquee } from "@/components/ui/marquee";
import type { CSSProperties } from "react";
import Link from "next/link";
import { discoverDestinations, discoverDestinationHref } from "@/data/discover-destinations";
import { discoverBentoCollections, discoverCollectionHref } from "@/data/discover-collections";
import { discoverPhotos, journeyColumns } from "@/data/discover-preview";

const heading = "font-display text-[clamp(1.8rem,3.8vw,4rem)] leading-none font-bold tracking-tight";

export function DiscoverHero() {
    return (
        <section
            aria-labelledby="discover-title"
            className="bg-background relative flex min-h-[42rem] w-[var(--panel-width)] shrink-0 snap-start flex-col overflow-hidden px-5 pt-36 pb-8 md:px-10 md:pt-16 lg:h-dvh lg:min-h-[38rem] lg:pb-0"
        >
            <header className="relative z-10">
                <h1
                    id="discover-title"
                    className="font-display text-[clamp(2.7rem,9.2vw,9rem)] leading-[.95] font-bold tracking-[-.055em]"
                >
                    DISCOVER
                </h1>
                <p className="mt-4 text-[clamp(1rem,2vw,2rem)]">The world is at your fingertips.</p>
            </header>
            <div className="mt-8 grid flex-1 grid-cols-1 gap-7 md:grid-cols-[1.55fr_1fr] md:gap-10 lg:min-h-0">
                <div className="relative min-h-64 overflow-hidden rounded-r-[50%] md:min-h-96 lg:min-h-0 lg:rounded-tr-[100%] lg:rounded-br-none">
                    <DiscoverPhoto photo={discoverPhotos.kyoto} eager width={1600} position="53% center" />
                </div>
                <div className="flex max-w-80 flex-col justify-end pb-7 md:pb-12 lg:pb-10">
                    <p className="text-[clamp(1.25rem,2.3vw,2rem)] leading-tight">
                        Destination
                        <br />
                        of the Month
                    </p>
                    <div className="border-line my-5 border-y py-4">
                        <p className="font-display text-20">JAPAN</p>
                        <h2 className="font-display text-[clamp(3.5rem,6.4vw,6rem)] leading-none font-bold tracking-tight">
                            KYOTO
                        </h2>
                    </div>
                    <p className="text-14 leading-relaxed">
                        Handpicked by the Roamboard Editorial Team through a mix of traveler activity, emerging trends,
                        seasonal timing, and what’s looking especially good right now — all in search of the most
                        unforgettable trip for you.
                    </p>
                    <Link
                        href="/discover/destinations/kyoto"
                        className="text-14 mt-6 inline-flex min-h-11 items-center gap-3 self-start underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        explore <span aria-hidden="true">→</span>
                    </Link>
                </div>
            </div>
            <p className="text-muted-foreground text-10 absolute top-28 left-5 md:top-5 md:left-10">
                DESIGN PREVIEW · SAMPLE CONTENT
            </p>
        </section>
    );
}

export function DiscoverJourney({ mobilePanel }: { mobilePanel?: number } = {}) {
    const columns =
        mobilePanel === undefined ? journeyColumns : journeyColumns.slice(mobilePanel * 2, mobilePanel * 2 + 2);
    return (
        <section
            aria-label="A world of travel inspiration"
            className={`relative min-h-[38rem] shrink-0 overflow-hidden bg-black ${mobilePanel === undefined ? "h-[min(100dvh,56rem)] w-[max(100vw,221dvh)]" : "w-full flex-1"}`}
        >
            <div
                className={`grid h-full gap-2 px-2 ${mobilePanel === undefined ? "grid-cols-6" : "absolute inset-0 grid-cols-2"}`}
            >
                {columns.map((column, index) => (
                    <Marquee
                        key={index}
                        vertical
                        repeat={mobilePanel === undefined ? 2 : 6}
                        reverse={index % 2 === 1}
                        className="h-full min-w-0"
                        style={
                            {
                                "--gap": "0.5rem",
                                "--delay": `${(column.offset / 100) * column.photos.length * 28}s`,
                                "--duration": `${column.photos.length * 28}s`
                            } as CSSProperties
                        }
                        aria-hidden="true"
                    >
                        {column.photos.map((photo, photoIndex) => (
                            <div
                                key={`${index}-${photoIndex}`}
                                className="relative aspect-[2/3] shrink-0 overflow-hidden"
                            >
                                <DiscoverPhoto photo={photo} width={800} eager />
                            </div>
                        ))}
                    </Marquee>
                ))}
            </div>
        </section>
    );
}

export function DiscoverFeed() {
    return (
        <div className="bg-background w-[var(--panel-width)] shrink-0">
            <div className="px-5 pt-14 md:px-10 md:pt-10">
                <section aria-labelledby="discover-feed" className="@container/bento">
                    <h2
                        id="discover-feed"
                        tabIndex={-1}
                        className={`${heading} scroll-mt-8 focus-visible:outline-2 focus-visible:outline-offset-8`}
                    >
                        CURATED COLLECTIONS
                    </h2>
                    <div className="mt-5 grid gap-2 @min-[26rem]/bento:auto-rows-[minmax(14rem,auto)] @min-[26rem]/bento:grid-cols-2 @min-[68rem]/bento:grid-cols-12 @min-[68rem]/bento:grid-rows-[repeat(2,minmax(14rem,1fr))]">
                        {discoverBentoCollections.map((collection) => (
                            <Link
                                key={collection.id}
                                href={discoverCollectionHref(collection)}
                                aria-label={`Explore ${collection.title}`}
                                className={`group focus-visible:outline-foreground @container/tile relative flex min-h-56 cursor-pointer items-center overflow-hidden text-white focus-visible:outline-2 focus-visible:outline-offset-4 ${collection.large ? "@min-[26rem]/bento:row-span-2" : ""} ${collection.layout}`}
                            >
                                <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03] group-focus-visible:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none">
                                    <DiscoverPhoto
                                        photo={collection.coverImage}
                                        width={collection.large ? 1100 : 800}
                                        position={collection.coverPosition ?? "center"}
                                    />
                                </div>
                                <div
                                    aria-hidden="true"
                                    className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent"
                                />
                                <div className="relative w-full p-5 @min-[68rem]/bento:p-6">
                                    <h3
                                        aria-label={collection.title}
                                        className={`font-body leading-none font-bold ${collection.large ? "text-[clamp(2.25rem,16cqw,3.75rem)]" : "text-[clamp(1.25rem,10cqw,2.25rem)]"}`}
                                    >
                                        {(collection.lines ?? [collection.title]).map((line) => (
                                            <span key={line} className="block">
                                                {line}
                                            </span>
                                        ))}
                                    </h3>
                                    <p className="text-12 mt-4 max-w-52 border-t border-white/50 pt-3 leading-snug">
                                        {collection.description}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
                <DiscoverSearch />
                <section aria-labelledby="trending-title" className="@container/bento mt-20 md:mt-24">
                    <h2 id="trending-title" className={heading}>
                        TRENDING DESTINATIONS
                    </h2>
                    <div className="mt-5 grid gap-2 @min-[17rem]/bento:grid-cols-2 @min-[68rem]/bento:grid-cols-12 @min-[68rem]/bento:grid-rows-[repeat(6,5.2rem)]">
                        {discoverDestinations.map((destination) => (
                            <Link
                                key={destination.countryCode}
                                href={discoverDestinationHref(destination)}
                                aria-label={`Explore ${destination.name}`}
                                className={`group focus-visible:outline-foreground @container/tile relative min-h-56 cursor-pointer overflow-hidden text-white focus-visible:outline-2 focus-visible:outline-offset-4 @min-[68rem]/bento:min-h-0 ${destination.layout}`}
                            >
                                <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03] group-focus-visible:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none">
                                    <DiscoverPhoto photo={destination.coverImage} width={900} />
                                </div>
                                <div
                                    aria-hidden="true"
                                    className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/65"
                                />
                                <h3 className="relative p-3 text-[clamp(1rem,12cqw,2.5rem)] leading-[1.05] font-bold uppercase @min-[68rem]/bento:p-5">
                                    {destination.name}
                                </h3>
                                <p className="text-10 absolute right-3 bottom-3">
                                    {destination.previewBoardCount} boards
                                    <span className="sr-only"> (sample count)</span>
                                </p>
                            </Link>
                        ))}
                    </div>
                </section>
                <DiscoverMoodMarquees />
                <FeaturedBoards />
            </div>
            <div className="h-32 bg-gradient-to-b from-transparent to-black" />
            <VibeGrid />
            <RoamFlow initialPage={roamFlowInitialPage} />
            <footer className="border-line border-t px-5 py-10 md:px-10">
                <details className="text-12">
                    <summary className="w-fit cursor-pointer py-2 underline underline-offset-4 focus-visible:outline-2">
                        Photo credits & sources
                    </summary>
                    <p className="mt-3 max-w-2xl">
                        Photography from Unsplash. The first seven source links were supplied as image URLs; their
                        photographer credits still need to be resolved before API integration.
                    </p>
                    <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(discoverPhotos).map(([key, photo]) => (
                            <li key={key}>
                                <LibraryCredit source={photo.src}>
                                    <a
                                        className="underline underline-offset-4 focus-visible:outline-2"
                                        href={photo.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {photo.alt}
                                    </a>
                                    {photo.photographer && (
                                        <span>
                                            {" "}
                                            —{" "}
                                            {photo.photographerUrl ? (
                                                <a
                                                    href={photo.photographerUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="underline underline-offset-4"
                                                >
                                                    {photo.photographer}
                                                </a>
                                            ) : (
                                                photo.photographer
                                            )}
                                        </span>
                                    )}
                                </LibraryCredit>
                            </li>
                        ))}
                    </ul>
                </details>
            </footer>
        </div>
    );
}
