/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import InteractiveMap, { type MapPoint } from "@/components/features/providers/InteractiveMap";
import { useBoardLeaveWarning } from "@/lib/use-board-leave-warning";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PinCategoryIcon from "@/components/ui/PinCategoryIcon";
import { categoryFromMapboxType, pinCategories } from "@/lib/board-options";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import {
    loadMapboxMapSession,
    loadProviderConfig,
    searchBoardLocationProvider,
    searchUnsplashProvider,
    type MapboxSearchResult,
    type ProviderPhoto
} from "@/lib/providers";
import {
    dayColors,
    type BoardDayDraft,
    type BoardImageDraft,
    type BoardPinDraft,
    type PinCategory,
    type PinLocation
} from "@/types/board-creator";

type Props = {
    day: BoardDayDraft;
    days: BoardDayDraft[];
    onClose: () => void;
    onAdd: (dayId: string, pin: BoardPinDraft, image: BoardImageDraft | null) => void;
    onEditExisting: (pinId: string) => void;
};

function mapPoint(pin: BoardPinDraft, dayIndex: number): MapPoint | null {
    if (!pin.location) return null;
    return {
        id: pin.id,
        label: pin.title,
        detail: pin.location.address,
        type: pin.category,
        latitude: pin.location.latitude,
        longitude: pin.location.longitude,
        color: dayColors[dayIndex % dayColors.length]
    };
}

function locationFromResult(place: MapboxSearchResult): PinLocation {
    return {
        name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        country: place.country,
        countryCode: place.countryCode,
        city: place.city,
        mapboxId: place.id
    };
}

function imageFromPhoto(photo: ProviderPhoto, pinId: string): BoardImageDraft {
    return {
        id: crypto.randomUUID(),
        pinId,
        publicId: photo.id,
        source: "unsplash",
        url: photo.url,
        thumbnailUrl: photo.thumbnailUrl,
        width: photo.width,
        height: photo.height,
        capturedAt: null,
        latitude: null,
        longitude: null,
        order: 0,
        credit: photo.photographer,
        creditUrl: photo.photographerUrl,
        sourceUrl: photo.sourceUrl
    };
}

export default function AddPinDialog({ day, days, onClose, onAdd, onEditExisting }: Props) {
    const photoRequestRef = useRef(0);
    const dialogRef = useRef<HTMLDivElement>(null);
    const [discardTarget, setDiscardTarget] = useState<string | null>(null);
    useDialogFocus(dialogRef, requestClose, discardTarget === null);
    const [token, setToken] = useState<string>();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<MapboxSearchResult[]>([]);
    const [selected, setSelected] = useState<PinLocation | null>(null);
    const [manualName, setManualName] = useState("");
    const [manualLatitude, setManualLatitude] = useState("");
    const [manualLongitude, setManualLongitude] = useState("");
    const [photo, setPhoto] = useState<ProviderPhoto | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [time, setTime] = useState("09:00");
    const [category, setCategory] = useState<PinCategory>("activity");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const changed = Boolean(
        title ||
        description ||
        query ||
        manualName ||
        manualLatitude ||
        manualLongitude ||
        selected ||
        photo ||
        time !== "09:00" ||
        category !== "activity"
    );
    useBoardLeaveWarning(changed);
    function requestClose() {
        if (changed) setDiscardTarget("close");
        else onClose();
    }
    function requestEditExisting(pinId: string) {
        if (changed) setDiscardTarget(pinId);
        else onEditExisting(pinId);
    }

    const points = useMemo(
        () =>
            days
                .flatMap((boardDay, dayIndex) =>
                    boardDay.pins.flatMap((pin) => {
                        const point = mapPoint(pin, dayIndex);
                        return point ? [point] : [];
                    })
                )
                .concat(
                    selected
                        ? [
                              {
                                  id: "selected-place",
                                  label: title || selected.name,
                                  detail: selected.address,
                                  type: category,
                                  latitude: selected.latitude,
                                  longitude: selected.longitude,
                                  color: dayColors[(day.dayNumber - 1) % dayColors.length]
                              }
                          ]
                        : []
                ),
        [days, selected, title, category, day.dayNumber]
    );

    useEffect(() => {
        void loadProviderConfig()
            .then((config) =>
                config.mapbox.configured
                    ? loadMapboxMapSession()
                    : Promise.reject(new Error("Mapbox is not configured."))
            )
            .then((session) => setToken(session.publicToken))
            .catch(() => setToken(undefined));
    }, []);

    async function search(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (query.trim().length < 2) {
            setError("Enter at least two characters to search.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const places = await searchBoardLocationProvider(query.trim());
            const priority = (place: MapboxSearchResult) =>
                ["place", "poi"].includes(place.placeType)
                    ? 0
                    : ["locality", "neighborhood", "district", "region", "country"].includes(place.placeType)
                      ? 1
                      : 2;
            setResults([...places].sort((first, second) => priority(first) - priority(second)));
        } catch (caught) {
            setResults([]);
            const message = caught instanceof Error ? caught.message : "Location search failed.";
            setError(
                message.includes("Route GET")
                    ? "The Board search endpoint is not loaded. Restart the backend dev server, then try again."
                    : message
            );
        } finally {
            setLoading(false);
        }
    }

    async function selectPlace(place: MapboxSearchResult) {
        const requestId = ++photoRequestRef.current;
        setResults([]);
        setSelected(locationFromResult(place));
        setManualName(place.name);
        setManualLatitude(String(place.latitude));
        setManualLongitude(String(place.longitude));
        setTitle(place.name);
        setCategory(categoryFromMapboxType(place.placeType));
        setPhoto(null);
        setError("");
        try {
            const name = place.name.replace(/-shi$/i, "");
            const terms = [...new Set([name, place.city?.replace(/-shi$/i, ""), place.country].filter(Boolean))];
            const photos = await searchUnsplashProvider(terms.join(" "));
            if (photoRequestRef.current === requestId) setPhoto(photos[0] ?? null);
        } catch {
            if (photoRequestRef.current === requestId) {
                setPhoto(null);
            }
        }
    }

    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setError("Give this pin a title.");
            return;
        }
        const hasManualLocation = Boolean(manualName.trim() || manualLatitude.trim() || manualLongitude.trim());
        if (hasManualLocation) {
            const latitude = Number(manualLatitude);
            const longitude = Number(manualLongitude);
            if (
                !manualName.trim() ||
                !manualLatitude.trim() ||
                !manualLongitude.trim() ||
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude) ||
                Math.abs(latitude) > 90 ||
                Math.abs(longitude) > 180
            ) {
                setError("Enter a location name, latitude from -90 to 90, and longitude from -180 to 180.");
                return;
            }
        }
        const selectedProviderPlace =
            selected !== null &&
            manualName.trim() === selected.name &&
            Number(manualLatitude) === selected.latitude &&
            Number(manualLongitude) === selected.longitude;
        const location = hasManualLocation
            ? {
                  name: manualName.trim(),
                  latitude: Number(manualLatitude),
                  longitude: Number(manualLongitude),
                  address:
                      (selectedProviderPlace ? selected?.address : null) ??
                      `${Number(manualLatitude).toFixed(5)}, ${Number(manualLongitude).toFixed(5)}`,
                  city: selectedProviderPlace ? (selected?.city ?? null) : null,
                  country: selectedProviderPlace ? (selected?.country ?? null) : null,
                  countryCode: selectedProviderPlace ? (selected?.countryCode ?? null) : null,
                  mapboxId: selectedProviderPlace ? (selected?.mapboxId ?? null) : null
              }
            : selected;
        const pinId = crypto.randomUUID();
        onAdd(
            day.id,
            {
                id: pinId,
                order: day.pins.length,
                time,
                title: trimmedTitle,
                description: description.trim(),
                category,
                source: selectedProviderPlace ? "geoapify" : "manual",
                location
            },
            photo ? imageFromPhoto(photo, pinId) : null
        );
        onClose();
    }

    return (
        <>
            {discardTarget ? (
                <ConfirmDialog
                    title="Discard this unfinished activity?"
                    description="Add the activity to your day plan to keep it in your Board edits. Cancel to continue working on it."
                    confirmLabel="Discard activity"
                    onCancel={() => setDiscardTarget(null)}
                    onConfirm={() => {
                        if (discardTarget === "close") onClose();
                        else onEditExisting(discardTarget);
                    }}
                />
            ) : null}
            <div
                inert={discardTarget !== null}
                className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3 sm:p-8"
                role="presentation"
                onMouseDown={(event) => {
                    if (event.target === event.currentTarget) requestClose();
                }}
            >
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="add-pin-heading"
                    tabIndex={-1}
                    className="bg-background max-h-[92dvh] w-full max-w-6xl overflow-y-auto shadow-2xl outline-none"
                >
                    <header className="border-line flex items-start justify-between border-b p-5 sm:p-7">
                        <div>
                            <p className="text-10 tracking-label text-muted-foreground font-bold uppercase">
                                Day {day.dayNumber}
                            </p>
                            <h2 id="add-pin-heading" className="font-display text-30 mt-2 font-bold">
                                Add a pin
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={requestClose}
                            className="border-line text-24 grid size-10 place-items-center border focus-visible:outline-2 focus-visible:outline-offset-2"
                            aria-label="Close activity dialog"
                        >
                            ×
                        </button>
                    </header>
                    <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
                        <div className="border-line border-b p-5 sm:p-7 lg:border-r lg:border-b-0">
                            <form onSubmit={(event) => void search(event)}>
                                <label htmlFor="pin-place-search" className="text-12 text-graphite">
                                    Search Mapbox
                                </label>
                                <div className="mt-2 flex gap-3">
                                    <input
                                        id="pin-place-search"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Senso-ji, Tokyo"
                                        className="border-line text-15 focus:border-foreground min-w-0 flex-1 border-b bg-transparent py-3 outline-none"
                                    />
                                    <button
                                        disabled={loading}
                                        className="border-foreground bg-foreground text-12 text-background border px-4 disabled:opacity-45"
                                    >
                                        {loading ? "Searching" : "Search"}
                                    </button>
                                </div>
                            </form>
                            {error ? (
                                <p className="text-13 mt-4" role="alert">
                                    {error}
                                </p>
                            ) : null}
                            <ul className="mt-5 grid gap-2">
                                {results.map((place) => (
                                    <li key={place.id}>
                                        <button
                                            type="button"
                                            onClick={() => void selectPlace(place)}
                                            className="border-line hover:border-foreground w-full border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                                        >
                                            <span className="flex flex-wrap items-center gap-2">
                                                <strong className="text-14">{place.name}</strong>
                                                <span className="border-line text-10 tracking-label text-graphite border px-2 py-1 uppercase">
                                                    {
                                                        pinCategories.find(
                                                            (item) =>
                                                                item.value === categoryFromMapboxType(place.placeType)
                                                        )?.label
                                                    }
                                                </span>
                                            </span>
                                            <span className="text-12 text-graphite mt-1 block">{place.address}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <div className="border-line mt-6 grid gap-3 border-t pt-5 sm:grid-cols-2">
                                <label className="text-12 text-graphite col-span-full">
                                    Location name
                                    <input
                                        value={manualName}
                                        onChange={(event) => setManualName(event.target.value)}
                                        placeholder="Place name"
                                        className="border-line text-14 text-foreground mt-2 w-full border-b bg-transparent py-2"
                                    />
                                </label>
                                <label className="text-12 text-graphite">
                                    Latitude
                                    <input
                                        type="number"
                                        step="any"
                                        min="-90"
                                        max="90"
                                        value={manualLatitude}
                                        onChange={(event) => setManualLatitude(event.target.value)}
                                        placeholder="59.3293"
                                        className="border-line text-14 text-foreground mt-2 w-full border-b bg-transparent py-2"
                                    />
                                </label>
                                <label className="text-12 text-graphite">
                                    Longitude
                                    <input
                                        type="number"
                                        step="any"
                                        min="-180"
                                        max="180"
                                        value={manualLongitude}
                                        onChange={(event) => setManualLongitude(event.target.value)}
                                        placeholder="18.0686"
                                        className="border-line text-14 text-foreground mt-2 w-full border-b bg-transparent py-2"
                                    />
                                </label>
                                <p className="text-10 text-stone col-span-full">
                                    Search results fill these fields when available. You can also enter coordinates
                                    yourself.
                                </p>
                            </div>
                            <form className="border-line mt-7 border-t pt-6" onSubmit={submit}>
                                {photo ? (
                                    <figure className="mb-5">
                                        <img
                                            src={photo.thumbnailUrl}
                                            alt={photo.alt}
                                            className="aspect-video w-full object-cover"
                                        />
                                        <figcaption className="text-10 text-stone mt-1">
                                            Photo by{" "}
                                            <a
                                                href={photo.photographerUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="underline"
                                            >
                                                {photo.photographer}
                                            </a>{" "}
                                            on{" "}
                                            <a
                                                href={photo.sourceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="underline"
                                            >
                                                Unsplash
                                            </a>
                                        </figcaption>
                                    </figure>
                                ) : null}
                                <div className="grid gap-5 sm:grid-cols-[8rem_1fr]">
                                    <label className="text-12 text-graphite">
                                        Time
                                        <input
                                            type="time"
                                            value={time}
                                            onChange={(event) => setTime(event.target.value)}
                                            className="border-line text-15 text-foreground focus:border-foreground mt-2 w-full border-b bg-transparent py-2 outline-none"
                                        />
                                    </label>
                                    <label className="text-12 text-graphite">
                                        Pin title
                                        <input
                                            value={title}
                                            onChange={(event) => setTitle(event.target.value)}
                                            placeholder="Activity or place"
                                            className="border-line text-15 text-foreground focus:border-foreground mt-2 w-full border-b bg-transparent py-2 outline-none"
                                        />
                                    </label>
                                </div>
                                <label className="text-12 text-graphite mt-5 block">
                                    Category
                                    <span className="border-line mt-2 flex items-center gap-3 border-b py-2">
                                        <PinCategoryIcon category={category} />
                                        <select
                                            value={category}
                                            onChange={(event) => setCategory(event.target.value as PinCategory)}
                                            className="text-14 text-foreground min-w-0 flex-1 bg-transparent outline-none"
                                        >
                                            {pinCategories.map((item) => (
                                                <option key={item.value} value={item.value}>
                                                    {item.label}
                                                </option>
                                            ))}
                                        </select>
                                    </span>
                                </label>
                                <label className="text-12 text-graphite mt-5 block">
                                    Notes
                                    <textarea
                                        value={description}
                                        onChange={(event) => setDescription(event.target.value)}
                                        placeholder="What should you remember?"
                                        rows={3}
                                        className="border-line text-14 text-foreground focus:border-foreground mt-2 w-full resize-y border bg-transparent p-3 outline-none"
                                    />
                                </label>
                                <p className="text-12 text-graphite mt-4">
                                    {selected
                                        ? `Selected: ${selected.address}`
                                        : "No location selected. This will be saved as a manual activity."}
                                </p>
                                <button className="border-foreground bg-foreground text-14 text-background mt-5 w-full border px-5 py-3">
                                    Add to day {day.dayNumber}
                                </button>
                            </form>
                        </div>
                        <div className="p-5 sm:p-7">
                            <div className="text-12 text-graphite mb-4 flex flex-wrap gap-4">
                                {days.map((boardDay, index) => (
                                    <span key={boardDay.id} className="inline-flex items-center gap-2">
                                        <span
                                            className="size-2.5 rounded-full"
                                            style={{
                                                backgroundColor: dayColors[index % dayColors.length]
                                            }}
                                        />
                                        Day {boardDay.dayNumber}
                                    </span>
                                ))}
                            </div>
                            <InteractiveMap
                                token={token}
                                points={points}
                                routeGeometry={[]}
                                onPointClick={(point) => {
                                    if (point.id !== "selected-place") requestEditExisting(point.id);
                                }}
                            />
                            <p className="text-12 text-graphite mt-3">
                                Existing Board pins are clickable. Search results must be selected from the list; the
                                map itself does not create pins.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
