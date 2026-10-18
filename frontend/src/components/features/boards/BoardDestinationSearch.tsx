"use client";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { MapPin, Search, X } from "lucide-react";
import { createDestinationSearchStore } from "@/lib/destination-search-store";
import { searchBoardAreas } from "@/lib/providers";
import type { Destination } from "@/lib/destinations";
import type { BoardDestinationDraft } from "@/types/board-creator";
export default function BoardDestinationSearch({
    value,
    suggested = false,
    onChange
}: {
    value: BoardDestinationDraft | null;
    suggested?: boolean;
    onChange: (destination: BoardDestinationDraft | null) => void;
}) {
    const id = useId();
    const [actions] = useState(() => createDestinationSearchStore(searchBoardAreas, value?.name ?? ""));
    const state = useSyncExternalStore(actions.subscribe, actions.getSnapshot, actions.getSnapshot);
    useEffect(() => {
        actions.resume();
        return () => actions.dispose();
    }, [actions]);
    function choose(place: Destination) {
        if (!place.countryCode) return;
        actions.select(place);
        onChange({
            name: place.name,
            address: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
            country: place.country,
            countryCode: place.countryCode,
            city: place.city,
            mapboxId: place.id,
            kind:
                place.placeType === "country"
                    ? "country"
                    : ["state", "region", "county", "district"].includes(place.placeType)
                      ? "region"
                      : "city"
        });
    }
    const show = state.open && state.query.trim().length >= 2;
    return (
        <div
            className="mb-10"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) actions.setOpen(false);
            }}
        >
            <label htmlFor={id} className="text-foreground/80 text-20 sm:text-24 block font-bold">
                Main destination
            </label>
            <p id={id + "-hint"} className="text-muted-foreground mt-2 text-xs leading-relaxed">
                Choose the city, region or state your board mostly covers. Its country is included automatically.
            </p>
            <div className="border-line focus-within:border-foreground mt-3 flex items-center gap-3 border-b py-3">
                <Search aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                <input
                    id={id}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={show}
                    aria-controls={show ? id + "-results" : undefined}
                    aria-activedescendant={
                        show && state.results[state.active] ? id + "-option-" + state.active : undefined
                    }
                    aria-describedby={id + "-hint"}
                    autoComplete="off"
                    maxLength={100}
                    value={state.query}
                    placeholder="e.g. Bali, California or Stockholm"
                    className="min-w-0 flex-1 bg-transparent py-1 text-base outline-none"
                    onFocus={() => {
                        if (!value) actions.setOpen(true);
                    }}
                    onChange={(event) => {
                        onChange(null);
                        actions.setQuery(event.target.value);
                    }}
                    onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) return;
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                            event.preventDefault();
                            actions.moveSelection(event.key === "ArrowDown" ? 1 : -1);
                        } else if (event.key === "Enter") {
                            event.preventDefault();
                            const place = actions.submit();
                            if (place) choose(place);
                        } else if (event.key === "Escape") {
                            event.preventDefault();
                            actions.setOpen(false);
                        }
                    }}
                />
                {state.query ? (
                    <button
                        type="button"
                        aria-label="Clear main destination"
                        className="text-muted-foreground grid size-9 place-items-center"
                        onClick={() => {
                            actions.setQuery("");
                            onChange(null);
                        }}
                    >
                        <X className="size-4" />
                    </button>
                ) : null}
            </div>
            {show ? (
                <div className="border-line bg-background text-foreground mt-2 rounded-xl border p-2">
                    {state.loading ? (
                        <p role="status" className="text-muted-foreground p-3 text-xs">
                            Finding destinations...
                        </p>
                    ) : state.error ? (
                        <div role="alert" className="p-3 text-xs">
                            {state.error}
                            <button
                                type="button"
                                className="ml-2 underline"
                                onClick={() => actions.setQuery(state.query)}
                            >
                                Try again
                            </button>
                        </div>
                    ) : state.searched && !state.results.length ? (
                        <p role="status" className="text-muted-foreground p-3 text-xs">
                            No destination found. Try adding the country.
                        </p>
                    ) : null}
                    {state.results.length ? (
                        <ul id={id + "-results"} role="listbox" aria-label="Main destinations">
                            {state.results.map((place, index) => (
                                <li key={place.id} role="presentation">
                                    <button
                                        id={id + "-option-" + index}
                                        role="option"
                                        aria-selected={state.active === index}
                                        type="button"
                                        className="hover:bg-faint aria-selected:bg-faint flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left"
                                        onClick={() => choose(place)}
                                    >
                                        <MapPin aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                                        <span>
                                            <strong className="block text-sm font-medium">{place.name}</strong>
                                            <span className="text-muted-foreground block text-xs">{place.address}</span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}
            {suggested ? (
                <p className="text-muted-foreground mt-3 text-xs">
                    Suggested from your activity locations. You can change it.
                </p>
            ) : null}
            {value ? (
                <p className="text-muted-foreground mt-3 text-xs">
                    {value.address || [value.name, value.country].filter(Boolean).join(", ")}
                </p>
            ) : null}
        </div>
    );
}
