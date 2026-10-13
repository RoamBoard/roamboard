import DiscoverPhoto from "./DiscoverPhoto";
import VibeGrid from "./VibeGrid";
import { Marquee } from "@/components/ui/marquee";
import type { CSSProperties } from "react";
import {
    discoverPhotos,
    journeyColumns,
    previewBoards,
    previewCollections,
    previewDestinations
} from "@/data/discover-preview";

const heading =
    "font-display text-[clamp(1.8rem,3.8vw,4rem)] leading-none font-bold tracking-tight";

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
                <p className="mt-4 text-[clamp(1rem,2vw,2rem)]">
                    The world is at your fingertips.
                </p>
            </header>
            <div className="mt-8 grid flex-1 grid-cols-1 gap-7 md:grid-cols-[1.55fr_1fr] md:gap-10 lg:min-h-0">
                <div className="relative min-h-64 overflow-hidden rounded-r-[50%] md:min-h-96 lg:min-h-0 lg:rounded-tr-[100%] lg:rounded-br-none">
                    <DiscoverPhoto
                        photo={discoverPhotos.kyoto}
                        eager
                        width={1600}
                        position="53% center"
                    />
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
                        Handpicked by the Roamboard Editorial Team through a mix
                        of traveler activity, emerging trends, seasonal timing,
                        and what’s looking especially good right now — all in
                        search of the most unforgettable trip for you.
                    </p>
                    <a
                        href="#discover-feed"
                        className="text-14 mt-6 inline-flex min-h-11 items-center gap-3 self-start underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        explore <span aria-hidden="true">→</span>
                    </a>
                </div>
            </div>
            <p className="text-muted-foreground text-10 absolute top-28 left-5 md:top-5 md:left-10">
                DESIGN PREVIEW · SAMPLE CONTENT
            </p>
        </section>
    );
}

export function DiscoverJourney() {
    return (
        <section
            aria-label="A world of travel inspiration"
            className="relative h-[min(100dvh,56rem)] min-h-[38rem] w-[max(100vw,221dvh)] shrink-0 overflow-hidden bg-black"
        >
            <div className="grid h-full grid-cols-6 gap-2 px-2">
                {journeyColumns.map((column, index) => (
                    <Marquee
                        key={index}
                        vertical
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
                                <DiscoverPhoto
                                    photo={photo}
                                    width={800}
                                    eager
                                />
                            </div>
                        ))}
                    </Marquee>
                ))}
            </div>
        </section>
    );
}

function FeaturedBoards() {
    return (
        <section
            aria-labelledby="featured-title"
            className="relative mt-24 mb-16 grid gap-6 lg:grid-cols-2 lg:gap-x-12 lg:gap-y-0"
        >
            <h2
                id="featured-title"
                className="font-display self-center text-[clamp(2.5rem,5.5vw,6rem)] leading-[.95] font-bold tracking-tight lg:col-start-1 lg:row-start-1 lg:text-right"
            >
                THIS
                <br className="hidden lg:block" /> WEEK’S{" "}
                <span className="lg:sr-only">FEATURED BOARDS</span>
            </h2>
            {previewBoards.map((board, index) => (
                <article
                    key={board.code}
                    className={`border-line bg-background relative grid min-h-80 grid-cols-[.9fr_1.1fr] overflow-hidden border ${index === 0 ? "lg:col-start-2 lg:row-start-1" : index === 1 ? "lg:col-start-1 lg:row-start-2 lg:-mt-20" : "lg:col-start-2 lg:row-start-2 lg:mt-8"}`}
                >
                    <div className="relative min-h-80">
                        <DiscoverPhoto photo={board.photo} width={700} />
                    </div>
                    <div className="relative z-10 px-4 pt-5 pb-20 md:px-6">
                        <h3 className="font-display text-[clamp(1.5rem,2.9vw,3rem)] leading-[.95] font-bold tracking-tight">
                            {board.title}
                        </h3>
                        <p className="text-12 mt-3">by {board.author}</p>
                        <p className="text-12 mt-5 leading-relaxed">
                            {board.description}
                        </p>
                        <ul className="text-12 mt-4 leading-relaxed">
                            {board.highlights.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                    <span
                        aria-hidden="true"
                        className="text-faint font-display absolute right-3 -bottom-5 text-[clamp(4rem,7vw,8rem)] leading-none font-bold"
                    >
                        {board.code}
                    </span>
                </article>
            ))}
            <p
                aria-hidden="true"
                className="font-display hidden self-end text-right text-[clamp(2.5rem,5.5vw,6rem)] leading-[.95] font-bold tracking-tight lg:col-start-1 lg:row-start-2 lg:block"
            >
                FEATURED
                <br />
                BOARDS
            </p>
        </section>
    );
}

export function DiscoverFeed() {
    return (
        <div className="bg-background w-[var(--panel-width)] shrink-0">
            <div className="px-5 pt-14 md:px-10 md:pt-10">
                <section aria-labelledby="discover-feed">
                    <h2
                        id="discover-feed"
                        tabIndex={-1}
                        className={`${heading} scroll-mt-8 focus-visible:outline-2 focus-visible:outline-offset-8`}
                    >
                        CURATED COLLECTIONS
                    </h2>
                    <div className="mt-5 grid gap-2 md:grid-cols-12 md:grid-rows-[repeat(2,minmax(14rem,1fr))]">
                        {previewCollections.map((collection) => (
                            <article
                                key={collection.title}
                                className={`relative flex min-h-56 items-center overflow-hidden text-white ${collection.layout}`}
                            >
                                <DiscoverPhoto
                                    photo={collection.photo}
                                    width={collection.large ? 1100 : 800}
                                    position={
                                        collection.title === "Slow mornings"
                                            ? "center 65%"
                                            : "center"
                                    }
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
                                <div className="relative w-full p-5 lg:p-6">
                                    <h3
                                        aria-label={collection.title}
                                        className={`font-body leading-none font-bold ${collection.large ? "text-48 lg:text-60" : "text-[clamp(1.1rem,2.1vw,2.25rem)]"}`}
                                    >
                                        {collection.lines.map((line) => (
                                            <span key={line} className="block">
                                                {line}
                                            </span>
                                        ))}
                                    </h3>
                                    <p className="text-12 mt-4 max-w-52 border-t border-white/50 pt-3 leading-snug">
                                        {collection.description}
                                    </p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
                <section
                    aria-label="Search preview"
                    className="mt-12 max-w-5xl md:mt-16"
                >
                    <label htmlFor="discover-search" className="sr-only">
                        Search by vibe, category, or place (preview only)
                    </label>
                    <input
                        id="discover-search"
                        disabled
                        aria-describedby="discover-preview-note"
                        placeholder="type in a vibe, category, or place"
                        className="border-line text-16 placeholder:text-muted-foreground w-full border-b bg-transparent py-5 disabled:cursor-not-allowed"
                    />
                    <ul
                        aria-label="Example search suggestions"
                        className="text-12 mt-5 flex flex-wrap gap-x-8 gap-y-3"
                    >
                        {[
                            "somewhere warm",
                            "48h away",
                            "food worth travelling for",
                            "quiet cities",
                            "after dark",
                            "by the water"
                        ].map((vibe) => (
                            <li key={vibe}>{vibe}</li>
                        ))}
                    </ul>
                    <p
                        id="discover-preview-note"
                        className="text-muted-foreground text-12 mt-5"
                    >
                        Visual preview — search, Board counts and editorial
                        selections are sample content. Opening and saving Boards
                        are not connected yet.
                    </p>
                </section>
                <section
                    aria-labelledby="trending-title"
                    className="mt-20 md:mt-24"
                >
                    <h2 id="trending-title" className={heading}>
                        TRENDING DESTINATIONS
                    </h2>
                    <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-12 md:grid-rows-[repeat(6,5.2rem)]">
                        {previewDestinations.map((destination) => (
                            <article
                                key={destination.name}
                                className={`relative min-h-56 overflow-hidden text-white md:min-h-0 ${destination.layout}`}
                            >
                                <DiscoverPhoto
                                    photo={destination.photo}
                                    width={900}
                                />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/65" />
                                <h3 className="relative p-3 text-[clamp(1rem,2.3vw,2.5rem)] leading-none font-bold uppercase lg:p-5">
                                    {destination.name}
                                </h3>
                                <p className="text-10 absolute right-3 bottom-3">
                                    {destination.count} boards
                                </p>
                            </article>
                        ))}
                    </div>
                </section>
                <FeaturedBoards />
            </div>
            <div className="h-32 bg-gradient-to-b from-transparent to-black" />
            <VibeGrid />
            <section
                aria-labelledby="roamflow-title"
                className="overflow-hidden bg-black px-5 pb-12 text-white md:px-10"
            >
                <header className="border-t border-white/25 pt-6 text-right">
                    <p className="text-14">Introducing</p>
                    <h2
                        id="roamflow-title"
                        className="font-display text-48 leading-none font-bold"
                    >
                        RoamFlow
                    </h2>
                </header>
                <div className="mt-8 grid grid-cols-2 items-start gap-3 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((index) => (
                        <article
                            key={index}
                            className={`relative aspect-[4/5] overflow-hidden border border-white/25 ${index % 2 === 0 ? "mt-16" : ""}`}
                        >
                            <DiscoverPhoto
                                photo={discoverPhotos.hiddenGems}
                                width={700}
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-transparent" />
                            <div className="relative p-4">
                                <h3 className="text-[clamp(1rem,2vw,2rem)] leading-none font-bold">
                                    Postcards
                                    <br />
                                    from Porto
                                </h3>
                                <p className="text-10 mt-3">by Inês Carvalho</p>
                            </div>
                        </article>
                    ))}
                </div>
                <p className="text-12 mt-6 text-white/70">
                    RoamFlow concept preview · imagery and stories are
                    placeholders.
                </p>
            </section>
            <footer className="border-line border-t px-5 py-10 md:px-10">
                <details className="text-12">
                    <summary className="w-fit cursor-pointer py-2 underline underline-offset-4 focus-visible:outline-2">
                        Photo credits & sources
                    </summary>
                    <p className="mt-3 max-w-2xl">
                        Photography from Unsplash. The first seven source links
                        were supplied as image URLs; their photographer credits
                        still need to be resolved before API integration.
                    </p>
                    <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(discoverPhotos).map(([key, photo]) => (
                            <li key={key}>
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
                            </li>
                        ))}
                    </ul>
                </details>
            </footer>
        </div>
    );
}
