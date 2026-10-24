"use client";

import { useEffect, useId, useState } from "react";
import { Check, MapPin, Search, X } from "lucide-react";
import { searchBoardLocationProvider, type MapboxSearchResult } from "@/lib/providers";
import { categoryFromMapboxType } from "@/lib/board-options";
import type { PinCategory, PinLocation } from "@/types/board-creator";

export function locationDetails(location: Pick<PinLocation, "name" | "address" | "city" | "country">): string {
    const address = location.address.toLocaleLowerCase().startsWith(location.name.toLocaleLowerCase() + ",")
        ? location.address.slice(location.name.length + 1).trim()
        : location.address === location.name
          ? ""
          : location.address;
    return [address, location.city, location.country]
        .filter(
            (part, index, all) =>
                part &&
                !all
                    .slice(0, index)
                    .some((previous) => previous?.toLocaleLowerCase().includes(part.toLocaleLowerCase()))
        )
        .join(", ");
}
export default function ActivityLocationSearch({
    value,
    onSelect,
    disabled = false,
    onSearchEdited,
    proximity
}: {
    value: PinLocation | null;
    onSelect: (location: PinLocation | null, category?: PinCategory) => void;
    disabled?: boolean;
    onSearchEdited?: () => void;
    proximity?: { latitude: number; longitude: number } | null;
}) {
    const id = useId();
    const [query, setQuery] = useState(value?.name ?? "");
    const [editing, setEditing] = useState(false);
    const [results, setResults] = useState<MapboxSearchResult[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const [highlighted, setHighlighted] = useState(-1);
    const latitude = proximity?.latitude;
    const longitude = proximity?.longitude;
    useEffect(() => {
        if (!editing || query.trim().length < 2) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setBusy(true);
            void searchBoardLocationProvider(
                query.trim(),
                controller.signal,
                latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined
            )
                .then((places) => {
                    if (!controller.signal.aborted) setResults(places);
                })
                .catch((caught) => {
                    if (!controller.signal.aborted)
                        setError(
                            caught instanceof Error ? caught.message : "Location search is unavailable. Try again."
                        );
                })
                .finally(() => {
                    if (!controller.signal.aborted) setBusy(false);
                });
        }, 350);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [editing, query, retry, latitude, longitude]);
    function choosePlace(place: MapboxSearchResult) {
        if (disabled) return;
        setHighlighted(-1);
        onSelect(
            {
                name: place.name,
                address: place.address,
                latitude: place.latitude,
                longitude: place.longitude,
                country: place.country,
                countryCode: place.countryCode,
                city: place.city,
                mapboxId: place.id
            },
            categoryFromMapboxType(place.placeType)
        );
        setQuery(place.name);
        setEditing(false);
        setResults([]);
        setBusy(false);
        setError("");
    }
    return (
        <div className="min-w-0">
            <label htmlFor={id} className="text-muted-foreground text-xs">
                Search location
            </label>
            <div className="border-line focus-within:border-foreground mt-2 flex items-center gap-3 border-b py-3">
                <Search className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                <input
                    id={id}
                    type="search"
                    value={query}
                    disabled={disabled}
                    placeholder="A place, neighbourhood, restaurant..."
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={results.length > 0}
                    aria-controls={id + "-results"}
                    aria-activedescendant={highlighted >= 0 ? id + "-option-" + highlighted : undefined}
                    onKeyDown={(event) => {
                        if (event.key === "Escape" && (editing || results.length)) {
                            event.preventDefault();
                            event.stopPropagation();
                            setEditing(false);
                            setResults([]);
                            setBusy(false);
                            setHighlighted(-1);
                            return;
                        }
                        if (!results.length) return;
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                            event.preventDefault();
                            setHighlighted((current) =>
                                event.key === "ArrowDown"
                                    ? Math.min(results.length - 1, current + 1)
                                    : Math.max(0, current - 1)
                            );
                        } else if (event.key === "Enter" && highlighted >= 0) {
                            event.preventDefault();
                            choosePlace(results[highlighted]);
                        }
                    }}
                    aria-describedby={id + "-hint"}
                    className="placeholder:text-muted-foreground/65 min-w-0 flex-1 bg-transparent text-base outline-none"
                    onChange={(event) => {
                        onSearchEdited?.();
                        setQuery(event.target.value);
                        setEditing(true);
                        setResults([]);
                        setHighlighted(-1);
                        setError("");
                        setBusy(event.target.value.trim().length >= 2);
                        if (value) onSelect(null);
                    }}
                />
                {value ? (
                    <button
                        type="button"
                        disabled={disabled}
                        aria-label="Change location"
                        onClick={() => {
                            onSelect(null);
                            setQuery("");
                            setHighlighted(-1);
                            setEditing(true);
                            setResults([]);
                            setBusy(false);
                        }}
                        className="text-muted-foreground grid size-8 place-items-center"
                    >
                        <X className="size-4" />
                    </button>
                ) : null}
            </div>
            <p id={id + "-hint"} className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                {proximity
                    ? "Try a place name, cafes, museums, or cafe: Starbucks. Nearby places are preferred."
                    : "Search any place or address. Add an area or city to narrow it down."}
            </p>
            {busy ? (
                <p role="status" className="text-muted-foreground mt-4 text-xs">
                    Finding places...
                </p>
            ) : null}
            {error ? (
                <div role="alert" className="mt-4 text-xs leading-relaxed">
                    {error}
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                            setError("");
                            setBusy(true);
                            setRetry((current) => current + 1);
                        }}
                        className="ml-2 underline underline-offset-4"
                    >
                        Try again
                    </button>
                </div>
            ) : null}
            {!busy && !error && editing && query.trim().length >= 2 && !results.length ? (
                <p role="status" className="text-muted-foreground mt-4 text-xs">
                    No places found. Try a more specific name or add the city.
                </p>
            ) : null}
            {results.length ? (
                <ul
                    id={id + "-results"}
                    role="listbox"
                    aria-label="Location results"
                    className="border-line mt-3 max-h-64 overflow-y-auto border-b"
                >
                    {results.map((place, index) => (
                        <li key={place.id} role="presentation">
                            <button
                                type="button"
                                disabled={disabled}
                                role="option"
                                id={id + "-option-" + index}
                                aria-selected={highlighted === index}
                                className="hover:bg-faint focus-visible:bg-faint aria-selected:bg-faint flex w-full items-start gap-3 px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                                onClick={() => choosePlace(place)}
                            >
                                <MapPin aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                                <span className="min-w-0">
                                    <strong className="block text-sm font-medium">{place.name}</strong>
                                    <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                                        {locationDetails(place)}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            {value ? (
                <div className="mt-4 flex items-start gap-2">
                    <Check className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <p className="text-muted-foreground text-xs leading-relaxed">
                        {locationDetails(value) || value.name}
                    </p>
                </div>
            ) : null}
        </div>
    );
}
