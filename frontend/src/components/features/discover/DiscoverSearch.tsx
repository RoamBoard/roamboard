"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MapPin, Layers } from "lucide-react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import TagIcon from "@/components/ui/TagIcon";
import { boardTags, boardTagHref } from "@/data/board-tags";
import { discoverCollections, discoverCollectionHref } from "@/data/discover-collections";
import { discoverDestinations, discoverDestinationHref } from "@/data/discover-destinations";

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
                    <CommandEmpty>No matching categories or destinations. Try another name.</CommandEmpty>
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
                    <CommandGroup heading="Destinations">
                        {discoverDestinations.map((destination) => (
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
                Explore vibes, collections, and destinations. Public Board search is coming soon.
            </p>
            <p id="discover-preview-note" className="text-muted-foreground text-12 mt-3">
                Board counts and editorial selections are sample content. Opening and saving Boards are not connected
                yet.
            </p>
        </section>
    );
}
