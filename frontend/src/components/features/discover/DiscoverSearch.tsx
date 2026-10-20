"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MapPin, Layers } from "lucide-react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import TagIcon from "@/components/ui/TagIcon";
import { boardTags, boardTagHref } from "@/data/board-tags";
import { discoverCollections, discoverCollectionHref } from "@/data/discover-collections";
import { discoverDestinations, discoverDestinationHref } from "@/data/discover-destinations";
import { searchDestinations, type Destination } from "@/lib/destinations";
import { destinationGuideHref, featuredDestinationGuides } from "@/lib/destination-guides";

function normalizeSearch(text: string) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[-,&]/g, " ")
        .toLowerCase();
}

export default function DiscoverSearch() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [destinationSearch, setDestinationSearch] = useState<{
        query: string;
        destinations: Destination[];
        error: string;
    } | null>(null);
    const [attempt, setAttempt] = useState(0);
    const search = query.trim();
    const canSearch = search.length >= 2 && search.length <= 100;
    const currentSearch = destinationSearch?.query === search ? destinationSearch : null;

    useEffect(() => {
        if (!open || !canSearch) return;
        const controller = new AbortController();
        // Suggestions need only destination identities. Wikipedia and photos load after selection.
        const timer = setTimeout(() => {
            searchDestinations(search, controller.signal)
                .then((destinations) => {
                    if (!controller.signal.aborted)
                        setDestinationSearch({
                            query: search,
                            destinations: destinations.filter((city) => destinationGuideHref(city)),
                            error: ""
                        });
                })
                .catch((error: unknown) => {
                    if (!controller.signal.aborted)
                        setDestinationSearch({
                            query: search,
                            destinations: [],
                            error: error instanceof Error ? error.message : "Destinations could not be loaded."
                        });
                });
        }, 400);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [search, canSearch, open, attempt]);

    function navigate(href: string) {
        setOpen(false);
        router.push(href);
    }
    return (
        <section aria-label="Search Discover" className="mt-12 max-w-5xl md:mt-16">
            <Command
                label="Find a vibe, collection, or destination"
                filter={(value, search, keywords = []) => {
                    const content = normalizeSearch([value, ...keywords].join(" "));
                    const words = normalizeSearch(search).trim().split(/\s+/);
                    return words.every((word) => content.includes(word)) ? 1 : 0;
                }}
                onFocusCapture={() => setOpen(true)}
                onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
                }}
                onKeyDown={(event) => {
                    if (!open && event.key === "Enter") {
                        event.preventDefault();
                        setOpen(true);
                    }
                    if (event.key === "Escape") {
                        event.preventDefault();
                        setOpen(false);
                    }
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") setOpen(true);
                }}
            >
                <CommandInput
                    value={query}
                    onValueChange={(value) => {
                        setQuery(value);
                        setOpen(true);
                    }}
                    placeholder="type in a vibe, category, or place"
                    aria-label="Search vibes, collections, and destinations"
                    aria-describedby="discover-search-note"
                    aria-expanded={open}
                />
                <CommandList hidden={!open} className="border-line border-b">
                    {!canSearch ? (
                        <CommandEmpty>No matching categories or destinations. Try another name.</CommandEmpty>
                    ) : null}
                    {canSearch ? (
                        <>
                            <div role="status" className="text-muted-foreground px-3 py-2 text-xs">
                                {!currentSearch
                                    ? "Searching destinations..."
                                    : currentSearch.error
                                      ? currentSearch.error
                                      : !currentSearch.destinations.length
                                        ? "No matching destinations found."
                                        : "Select a city or country to open its guide."}
                                {currentSearch?.error ? (
                                    <button
                                        type="button"
                                        className="ml-3 min-h-11 underline underline-offset-4"
                                        onKeyDown={(event) => {
                                            // cmdk handles Enter as item selection; this button must keep its native action.
                                            if (event.key === "Enter") event.stopPropagation();
                                        }}
                                        onClick={() => {
                                            setDestinationSearch(null);
                                            setAttempt((value) => value + 1);
                                        }}
                                    >
                                        Retry destination search
                                    </button>
                                ) : null}
                            </div>
                            <CommandGroup heading="Destination guides">
                                {currentSearch?.destinations.map((city) => (
                                    <CommandItem
                                        key={city.id}
                                        value={`guide:${city.id}`}
                                        keywords={[search, city.name, city.address]}
                                        onSelect={() => navigate(destinationGuideHref(city)!)}
                                    >
                                        <MapPin size={16} aria-hidden="true" />
                                        <span>
                                            {city.name}
                                            <span className="text-muted-foreground ml-2 text-xs">
                                                {city.placeType === "country" ? "Country" : city.address}
                                            </span>
                                        </span>
                                        <ArrowUpRight className="ml-auto" size={14} aria-hidden="true" />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </>
                    ) : null}
                    <CommandGroup heading="Collections">
                        {discoverCollections.map((collection) => (
                            <CommandItem
                                key={collection.id}
                                value={`collection:${collection.id}`}
                                keywords={[collection.title, collection.description]}
                                onSelect={() => navigate(discoverCollectionHref(collection))}
                            >
                                <Layers size={16} aria-hidden="true" />
                                <span>{collection.title}</span>
                                <ArrowUpRight className="ml-auto" size={14} aria-hidden="true" />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                    {!canSearch ? (
                        <CommandGroup heading="Destination guides">
                            {featuredDestinationGuides.map((destination) => (
                                <CommandItem
                                    key={destination.slug}
                                    value={`guide:${destination.slug}`}
                                    keywords={[destination.name, destination.country]}
                                    onSelect={() => navigate(`/discover/destinations/${destination.slug}`)}
                                >
                                    <MapPin size={16} aria-hidden="true" />
                                    <span>{destination.name}</span>
                                    <ArrowUpRight className="ml-auto" size={14} aria-hidden="true" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ) : null}
                    <CommandGroup heading="Destinations">
                        {discoverDestinations
                            .filter(
                                (destination) =>
                                    !currentSearch?.destinations.some(
                                        (result) =>
                                            result.placeType === "country" &&
                                            result.countryCode === destination.countryCode
                                    )
                            )
                            .map((destination) => (
                                <CommandItem
                                    key={destination.countryCode}
                                    value={`destination:${destination.countryCode}`}
                                    keywords={[destination.name, destination.description]}
                                    onSelect={() => navigate(discoverDestinationHref(destination))}
                                >
                                    <MapPin size={16} aria-hidden="true" />
                                    <span>{destination.name}</span>
                                    <ArrowUpRight className="ml-auto" size={14} aria-hidden="true" />
                                </CommandItem>
                            ))}
                    </CommandGroup>
                    <CommandGroup heading="Vibes">
                        {boardTags.map((tag) => (
                            <CommandItem
                                key={tag.id}
                                value={`tag:${tag.id}`}
                                keywords={[tag.name, tag.description]}
                                onSelect={() => navigate(boardTagHref(tag.id))}
                            >
                                <TagIcon tag={tag} size={16} />
                                <span>{tag.name}</span>
                                <ArrowUpRight className="ml-auto" size={14} aria-hidden="true" />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>
            <p id="discover-search-note" className="text-muted-foreground text-12 mt-4">
                Search a city or country and select a match to build its guide with photos and public boards.
            </p>
            <p id="discover-preview-note" className="text-muted-foreground text-12 mt-3">
                Editorial selections and counts on Discover are samples. Destination guides load real public boards.
            </p>
        </section>
    );
}
