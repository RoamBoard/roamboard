/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { destinationGuideHref, featuredDestinationGuides } from "@/lib/destination-guides";
import type { FormEvent } from "react";
import {
    loadDestinationContext,
    searchDestinations,
    type Destination,
    type DestinationContext
} from "@/lib/destinations";

const inputClasses =
    "w-full border-b border-line bg-transparent px-0 py-3 text-16 text-foreground outline-none placeholder:text-graphite focus:border-foreground";

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en", {
        weekday: "short",
        month: "short",
        day: "numeric"
    }).format(new Date(`${value}T12:00:00`));
}

export default function DestinationExplorer() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Destination[]>([]);
    const [selected, setSelected] = useState<DestinationContext | null>(null);
    const [loading, setLoading] = useState(false);
    const [contextLoading, setContextLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setError("Enter at least two characters to search for a destination.");
            return;
        }
        setLoading(true);
        setError("");
        setSelected(null);
        try {
            setResults(await searchDestinations(trimmed));
        } catch (caught) {
            setResults([]);
            setError(caught instanceof Error ? caught.message : "Destination search failed.");
        } finally {
            setLoading(false);
        }
    }

    async function chooseDestination(destination: Destination) {
        const guideHref = destinationGuideHref(destination);
        if (guideHref) {
            router.push(guideHref);
            return;
        }
        setContextLoading(true);
        setError("");
        try {
            setSelected(await loadDestinationContext(destination));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "This destination could not be loaded.");
        } finally {
            setContextLoading(false);
        }
    }

    return (
        <section className="w-full max-w-5xl px-6 py-16 sm:px-10 lg:px-20" aria-labelledby="destination-heading">
            <div className="max-w-2xl">
                <p className="font-body text-10 tracking-label text-graphite font-bold uppercase">
                    Destination discovery
                </p>
                <h1
                    id="destination-heading"
                    className="font-display text-48 text-foreground sm:text-72 mt-5 leading-[0.95] font-bold"
                >
                    Where will you wander?
                </h1>
                <p className="text-15 text-graphite mt-6 max-w-xl leading-7">
                    Search a place to explore its destination guide or compact travel brief.
                </p>
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Destination guide shortcuts">
                    {featuredDestinationGuides.map((destination) => (
                        <Link
                            key={destination.slug}
                            href={`/discover/destinations/${destination.slug}`}
                            className="inline-flex min-h-11 items-center underline underline-offset-4"
                        >
                            {destination.name} ↗
                        </Link>
                    ))}
                </div>
                <form className="mt-10 flex items-end gap-4" onSubmit={handleSearch}>
                    <label className="min-w-0 flex-1" htmlFor="destination-search">
                        <span className="sr-only">Destination or place</span>
                        <input
                            id="destination-search"
                            className={inputClasses}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Try Kyoto, Lisbon, or a neighborhood"
                            autoComplete="off"
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={loading}
                        className="border-foreground bg-foreground text-14 text-background shrink-0 border px-5 py-3 transition-opacity hover:opacity-75 disabled:cursor-wait disabled:opacity-50"
                    >
                        {loading ? "Searching" : "Search"}
                    </button>
                </form>
                {error ? (
                    <p className="border-foreground text-14 text-foreground mt-5 border-l-2 pl-3" role="alert">
                        {error}
                    </p>
                ) : null}
            </div>

            {results.length > 0 ? (
                <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Destination results">
                    {results.map((destination) => (
                        <button
                            key={destination.id}
                            type="button"
                            onClick={() => void chooseDestination(destination)}
                            className="border-line hover:border-foreground focus-visible:outline-foreground border p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            <span className="text-10 tracking-label text-graphite font-bold uppercase">
                                {destination.placeType}
                            </span>
                            <strong className="font-display text-24 text-foreground mt-4 block leading-tight">
                                {destination.name}
                            </strong>
                            <span className="text-14 text-graphite mt-2 block leading-6">{destination.address}</span>
                            <span className="text-12 text-foreground mt-5 block">
                                {contextLoading
                                    ? "Loading brief..."
                                    : destinationGuideHref(destination)
                                      ? "Open city guide ->"
                                      : "Open destination brief ->"}
                            </span>
                        </button>
                    ))}
                </div>
            ) : null}

            {!loading && query.trim().length >= 2 && results.length === 0 && !error ? (
                <p className="text-14 text-graphite mt-14">
                    No destinations found. Try a city, landmark, or neighborhood.
                </p>
            ) : null}

            {selected ? <DestinationBrief context={selected} /> : null}
        </section>
    );
}

function DestinationBrief({ context }: { context: DestinationContext }) {
    const { destination, weather, article, image, unavailable } = context;
    return (
        <article className="border-foreground mt-16 border-t pt-8" aria-labelledby="brief-heading">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
                <div>
                    <p className="text-10 tracking-label text-graphite font-bold uppercase">Selected destination</p>
                    <h2 id="brief-heading" className="font-display text-36 text-foreground mt-4 leading-none font-bold">
                        {destination.name}
                    </h2>
                    <p className="text-15 text-graphite mt-4 leading-7">{destination.address}</p>
                    <p className="text-12 text-graphite mt-2">
                        {destination.latitude.toFixed(4)}, {destination.longitude.toFixed(4)}
                    </p>
                    {article ? (
                        <div className="mt-10">
                            <h3 className="font-display text-22 text-foreground font-bold">A little context</h3>
                            <p className="text-15 text-graphite mt-3 leading-7">{article.description}</p>
                            <a
                                className="text-12 text-foreground mt-4 inline-block underline underline-offset-4"
                                href={article.url}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Read {article.title} on Wikipedia
                            </a>
                        </div>
                    ) : null}
                </div>
                <div>
                    {image ? (
                        <figure>
                            <img className="aspect-video w-full object-cover" src={image.url} alt={image.alt} />
                            <figcaption className="text-12 text-graphite mt-2">
                                Photo by{" "}
                                <a
                                    className="underline underline-offset-4"
                                    href={image.photographerUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {image.photographer}
                                </a>{" "}
                                on{" "}
                                <a
                                    className="underline underline-offset-4"
                                    href={image.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Unsplash
                                </a>
                            </figcaption>
                        </figure>
                    ) : (
                        <div className="bg-faint text-14 text-graphite grid aspect-video place-items-center px-6 text-center">
                            Add an Unsplash key to show destination imagery.
                        </div>
                    )}
                    {weather ? (
                        <section className="mt-10" aria-labelledby="weather-heading">
                            <div className="flex items-baseline justify-between gap-4">
                                <h3 id="weather-heading" className="font-display text-22 text-foreground font-bold">
                                    Five-day weather
                                </h3>
                                <span className="text-12 text-graphite">{weather.timezone}</span>
                            </div>
                            <div className="border-line mt-4 grid grid-cols-5 gap-2 border-y py-4">
                                {weather.dates.map((date, index) => (
                                    <div key={date} className="min-w-0">
                                        <p className="text-10 tracking-label text-graphite font-bold uppercase">
                                            {formatDate(date)}
                                        </p>
                                        <p className="font-display text-20 text-foreground mt-3">
                                            {Math.round(weather.maximums[index] ?? 0)}°
                                        </p>
                                        <p className="text-12 text-graphite">
                                            {Math.round(weather.minimums[index] ?? 0)}° /{" "}
                                            {weather.precipitation[index] ?? 0}% rain
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : (
                        <p className="text-14 text-graphite mt-10">Weather is temporarily unavailable.</p>
                    )}
                </div>
            </div>
            {unavailable.length > 0 ? (
                <p className="text-12 text-graphite mt-8">
                    Some optional details are unavailable right now: {unavailable.join(", ")}.
                </p>
            ) : null}
        </article>
    );
}
