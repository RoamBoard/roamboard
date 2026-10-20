"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import { loadMapboxMapSession } from "@/lib/providers";
import type { DestinationGuideData, PlaceDetails } from "@/lib/destination-guides";
import BoardPhoto from "@/components/features/boards/BoardPhoto";
import {
    placeBoardHref,
    cityGuideHref,
    matchPlace,
    placeSourceUrl,
    loadPlaceDetails,
    type StartingPlace
} from "@/lib/destination-places";

const InteractiveMap = dynamic(() => import("../providers/InteractiveMap"), { ssr: false });
const noRoute: Array<[number, number]> = [];
const pageSize = 5;

// Each page keeps five sights; compact spacing makes the same list fit smaller screens.
export default function DestinationPlaces({
    guide,
    onRetry,
    loading = false
}: {
    guide: DestinationGuideData;
    onRetry?: () => void;
    loading?: boolean;
}) {
    const isCountry = guide.destination.kind === "country";
    const itemName = isCountry ? "city" : "sight";
    const itemNames = isCountry ? "cities" : "sights";
    const listName = isCountry ? "Cities" : "Places";
    const mapName = isCountry ? "country" : "city";
    const [selected, setSelected] = useState<StartingPlace | null>(null);
    const [mobileView, setMobileView] = useState<"list" | "map">("list");
    const [page, setPage] = useState(0);
    const [token, setToken] = useState<string>();
    const [mapError, setMapError] = useState("");
    const [mapAttempt, setMapAttempt] = useState(0);
    const mapRequest = useRef<ReturnType<typeof loadMapboxMapSession> | null>(null);
    const matches = useRef(new Map<string, ReturnType<typeof matchPlace>>());
    const detailRequests = useRef(new Map<string, Promise<PlaceDetails>>());
    const [detailAttempt, setDetailAttempt] = useState(0);
    const [placeInfo, setPlaceInfo] = useState<{ placeId: string; data?: PlaceDetails; error?: string } | null>(null);
    const [mapMatch, setMapMatch] = useState<{
        id: string;
        point: { latitude: number; longitude: number } | null;
        message: string;
    } | null>(null);
    const detail = useRef<HTMLElement>(null);
    const places = useMemo(
        () =>
            guide.places.map((place) => ({
                ...place,
                city: guide.destination.name,
                country: guide.destination.countryCode
            })),
        [guide.places, guide.destination.name, guide.destination.countryCode]
    );
    const currentPage = Math.min(page, Math.max(0, Math.ceil(places.length / pageSize) - 1));
    const shown = places.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
    const points = useMemo(() => {
        return places.map((place) => {
            const point = { ...place, label: place.name };
            // Mapbox may move the displayed pin; Board links keep the original location.
            if (place.id === selected?.id && mapMatch?.id === place.id && mapMatch.point)
                return { ...point, ...mapMatch.point };
            return point;
        });
    }, [places, selected, mapMatch]);
    const listingSourceUrl = selected ? placeSourceUrl(selected) : undefined;
    const selectedInfo = placeInfo?.placeId === selected?.id ? placeInfo : null;
    const sourceUrl =
        selectedInfo?.data?.sourceUrl ??
        (isCountry && listingSourceUrl ? `${listingSourceUrl.split("#")[0]}#Cities` : listingSourceUrl);
    const firstSourceUrl = places[0] ? placeSourceUrl(places[0]) : undefined;
    const guideSourceUrl = isCountry && firstSourceUrl ? `${firstSourceUrl.split("#")[0]}#Cities` : firstSourceUrl;
    const selectedHref = selected ? (isCountry ? cityGuideHref(selected) : placeBoardHref(selected)) : undefined;

    useEffect(() => {
        if (!selected || !placeSourceUrl(selected)) return;
        const city = {
            ...(guide.destination.kind ? { kind: guide.destination.kind } : {}),
            name: guide.destination.name,
            country: guide.destination.countryCode,
            latitude: guide.destination.latitude,
            longitude: guide.destination.longitude
        };
        const request = detailRequests.current.get(selected.id) ?? loadPlaceDetails(city, selected.id);
        detailRequests.current.set(selected.id, request);
        const requestState = { active: true };
        // Late replies must not replace the newly selected sight. Incomplete results can be retried.
        void request.then(
            (data) => {
                if (data.unavailable.length) detailRequests.current.delete(selected.id);
                if (requestState.active) setPlaceInfo({ placeId: selected.id, data });
            },
            () => {
                detailRequests.current.delete(selected.id);
                if (requestState.active)
                    setPlaceInfo({
                        placeId: selected.id,
                        error: `This ${itemName}'s details could not load.`
                    });
            }
        );
        return () => {
            requestState.active = false;
        };
    }, [
        selected,
        itemName,
        guide.destination.name,
        guide.destination.countryCode,
        guide.destination.kind,
        guide.destination.latitude,
        guide.destination.longitude,
        detailAttempt
    ]);

    useEffect(() => {
        if (mobileView === "map" && window.matchMedia("(max-width: 767px)").matches)
            detail.current?.focus({ preventScroll: true });
    }, [mobileView]);

    useEffect(() => {
        if (isCountry || !selected || !placeSourceUrl(selected)) return;
        // Match only the selected sight. Keep Mapbox coordinates out of Board links.
        const request = matches.current.get(selected.id) ?? matchPlace(selected);
        matches.current.set(selected.id, request);
        const requestState = { active: true };
        void request.then(
            (point) => {
                if (requestState.active)
                    setMapMatch({
                        id: selected.id,
                        point,
                        message: point ? "Matched in Mapbox." : "Showing the travel-guide location."
                    });
            },
            () => {
                if (requestState.active)
                    setMapMatch({
                        id: selected.id,
                        point: null,
                        message: "Showing the travel-guide location. Mapbox could not match this sight."
                    });
            }
        );
        return () => {
            requestState.active = false;
        };
    }, [selected, isCountry]);

    useEffect(() => {
        // Show the city immediately, sharing the reservation during React's development effect replay.
        const request = mapRequest.current ?? loadMapboxMapSession();
        mapRequest.current = request;
        const requestState = { active: true };
        void request
            .then((session) => {
                if (requestState.active) setToken(session.publicToken);
            })
            .catch(() => {
                if (requestState.active)
                    setMapError(
                        isCountry
                            ? "The country map could not load. You can still open a city guide from the list."
                            : "The city map could not load. You can still start a Board from a sight."
                    );
            });
        return () => {
            requestState.active = false;
        };
    }, [mapAttempt, isCountry]);

    function choose(place: StartingPlace) {
        setSelected(place);
        const index = places.findIndex((item) => item.id === place.id);
        if (index >= 0) setPage(Math.floor(index / pageSize));
        // Phones switch views inside this chapter; desktop keeps the chosen row beside the map.
        setMobileView("map");
    }

    return (
        <section
            id="destination-places"
            aria-label={`Explore ${listName.toLowerCase()} in ${guide.destination.name}`}
            data-destination-selection
            data-destination-chapter
            tabIndex={-1}
            className="flex h-full w-[var(--destination-width)] shrink-0 snap-start snap-always flex-col overflow-hidden outline-none md:flex-row"
        >
            <div
                className="border-line flex shrink-0 gap-2 border-b px-6 md:hidden"
                role="group"
                aria-label={isCountry ? "City view" : "Place view"}
            >
                <button
                    type="button"
                    aria-pressed={mobileView === "list"}
                    onClick={() => setMobileView("list")}
                    className="aria-pressed:border-foreground min-h-11 flex-1 border-b-2 border-transparent px-4 text-sm aria-pressed:font-semibold"
                >
                    {listName}
                </button>
                <button
                    type="button"
                    aria-pressed={mobileView === "map"}
                    onClick={() => setMobileView("map")}
                    className="aria-pressed:border-foreground min-h-11 flex-1 border-b-2 border-transparent px-4 text-sm aria-pressed:font-semibold"
                >
                    Map
                </button>
            </div>
            <section
                id="destination-place-list"
                tabIndex={-1}
                aria-labelledby="destination-places-heading"
                className={`border-line h-0 min-h-0 w-full flex-1 flex-col border-r px-6 py-6 outline-none md:h-full md:w-[clamp(320px,30vw,440px)] md:flex-none md:px-8 md:py-8 [@media(max-height:540px)]:py-3 ${mobileView === "list" ? "flex" : "hidden md:flex"}`}
            >
                <p className="text-muted-foreground text-xs leading-5 [@media(max-height:540px)]:hidden">
                    Explore {guide.destination.name}
                </p>
                <h2
                    id="destination-places-heading"
                    className="font-display mt-2 text-[clamp(1.75rem,4dvh,2.5rem)] leading-[1.1] font-semibold tracking-tight [@media(max-height:540px)]:mt-0 [@media(max-height:540px)]:text-2xl"
                >
                    {`${listName} to explore`}
                </h2>
                <p className="text-muted-foreground mt-4 max-w-[34ch] text-sm leading-6 [@media(max-height:540px)]:hidden">
                    {isCountry ? "Choose a city to explore its guide." : "Choose a sight to start planning."}
                </p>
                {shown.length ? (
                    <ol
                        start={currentPage * pageSize + 1}
                        style={{ gridTemplateRows: `repeat(${pageSize}, minmax(0, 1fr))` }}
                        className="divide-line mt-4 grid min-h-0 flex-1 divide-y [@media(max-height:540px)]:mt-2"
                    >
                        {shown.map((place, index) => (
                            <li key={place.id} className="min-h-0">
                                <button
                                    type="button"
                                    aria-label={`Explore ${place.name}`}
                                    aria-pressed={selected?.id === place.id}
                                    onClick={() => choose(place)}
                                    className="hover:bg-faint/60 aria-pressed:bg-faint flex h-full w-full items-center gap-4 rounded-sm px-3 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 motion-reduce:transition-none md:py-2"
                                >
                                    <span className="border-line grid size-8 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums">
                                        {currentPage * pageSize + index + 1}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="line-clamp-2 text-sm leading-[1.2] font-semibold md:text-base md:leading-snug [@media(max-height:540px)]:line-clamp-1 [@media(max-height:540px)]:text-sm">
                                            {place.name}
                                        </span>
                                        <span className="text-muted-foreground mt-0.5 block truncate text-[11px] leading-4 md:mt-1 md:text-xs md:leading-5 [@media(max-height:540px)]:hidden">
                                            {place.address || place.city}
                                        </span>
                                    </span>
                                    <MapPin size={17} className="shrink-0" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 text-sm" role="status">
                        <p>
                            {guide.unavailable.includes("places")
                                ? loading
                                    ? `Loading travel-guide ${itemNames}...`
                                    : `Travel-guide ${itemNames} could not be loaded right now.`
                                : `No travel-guide ${itemNames} are available for ${guide.destination.name} yet.`}
                        </p>
                        {guide.unavailable.includes("places") ? (
                            <button
                                type="button"
                                onClick={onRetry}
                                disabled={loading}
                                className="min-h-11 w-fit underline"
                            >
                                Retry travel-guide {itemNames}
                            </button>
                        ) : null}
                    </div>
                )}
                <div className="border-line mt-3 shrink-0 border-t pt-3">
                    <p
                        aria-live="polite"
                        aria-atomic="true"
                        className="text-muted-foreground mb-3 flex justify-between gap-2 text-xs tabular-nums"
                    >
                        <span>
                            {places.length
                                ? `${currentPage * pageSize + 1}-${Math.min((currentPage + 1) * pageSize, places.length)} of ${places.length}`
                                : `0 ${listName.toLowerCase()}`}
                        </span>
                        {places.length > pageSize ? (
                            <span>
                                Page {currentPage + 1} of {Math.ceil(places.length / pageSize)}
                            </span>
                        ) : null}
                    </p>
                    {places.length > pageSize ? (
                        <nav
                            aria-label={`Recommended ${listName.toLowerCase()} pages`}
                            className="grid grid-cols-2 gap-3"
                        >
                            <button
                                type="button"
                                aria-label={`Previous ${listName.toLowerCase()} page`}
                                disabled={currentPage === 0}
                                onClick={() => setPage(currentPage - 1)}
                                className="border-line hover:bg-faint flex min-h-12 items-center justify-center gap-2 rounded-sm border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-30"
                            >
                                <ArrowLeft size={18} aria-hidden="true" /> Back 5
                            </button>
                            <button
                                type="button"
                                aria-label={`Next ${listName.toLowerCase()} page`}
                                disabled={(currentPage + 1) * pageSize >= places.length}
                                onClick={() => setPage(currentPage + 1)}
                                className="bg-foreground text-background flex min-h-12 items-center justify-center gap-2 rounded-sm px-3 text-sm font-semibold hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-30"
                            >
                                Next{" "}
                                {Math.min(pageSize, Math.max(0, places.length - (currentPage + 1) * pageSize)) ||
                                    pageSize}{" "}
                                <ArrowRight size={18} aria-hidden="true" />
                            </button>
                        </nav>
                    ) : null}
                </div>
                <p className="text-muted-foreground mt-2 shrink-0 text-[11px] leading-4">
                    {isCountry
                        ? "Cities listed in the country's travel guide."
                        : "Selected in the city's travel guide."}
                    <br />
                    {guideSourceUrl ? (
                        <>
                            <a href={guideSourceUrl} className="underline">
                                Wikivoyage contributors
                            </a>
                            {" / "}
                            <a href="https://creativecommons.org/licenses/by-sa/4.0/" className="underline">
                                CC BY-SA 4.0
                            </a>
                        </>
                    ) : null}
                </p>
            </section>
            <section
                ref={detail}
                tabIndex={-1}
                aria-label={isCountry ? "Selected city and country map" : "Selected place and city map"}
                className={`border-line h-0 min-h-0 w-full flex-1 flex-col border-r px-6 py-6 outline-none md:h-full md:w-auto md:min-w-0 md:px-8 md:py-8 [@media(max-height:540px)]:px-4 [@media(max-height:540px)]:py-3 ${mobileView === "map" ? "flex" : "hidden md:flex"}`}
            >
                <div className="mb-4 flex shrink-0 items-center justify-between gap-4 [@media(max-height:540px)]:hidden">
                    <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <MapPin size={16} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{selected?.city || guide.destination.name} map</span>
                    </p>
                    <p className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {points.length} {points.length === 1 ? (isCountry ? "city" : "place") : listName.toLowerCase()}
                    </p>
                </div>
                <div
                    className="border-line bg-faint relative min-h-0 flex-1 overflow-hidden rounded-lg border"
                    aria-label={guide.destination.kind === "country" ? "Country map" : "City map"}
                >
                    {token ? (
                        <InteractiveMap
                            token={token}
                            points={points}
                            routeGeometry={noRoute}
                            initialCenter={guide.destination}
                            initialZoom={isCountry ? 4 : 11}
                            selectedZoom={isCountry ? 6 : 14}
                            selectedPointId={selected?.id}
                            fillHeight
                            onPointClick={(point) => {
                                const place = places.find((item) => item.id === point.id);
                                if (place) choose(place);
                            }}
                        />
                    ) : (
                        <div className="grid h-full place-content-center gap-3 px-8 text-center text-sm">
                            <MapPin className="mx-auto" size={36} strokeWidth={1} />
                            <p role="status">{mapError || `Loading ${mapName} map...`}</p>
                            {mapError ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        mapRequest.current = null;
                                        setMapError("");
                                        setMapAttempt((value) => value + 1);
                                    }}
                                    className="min-h-11 underline"
                                >
                                    Retry {mapName} map
                                </button>
                            ) : null}
                        </div>
                    )}
                </div>
                {/* Keep place information and actions together instead of stretching a mostly empty footer. */}
                <div
                    className={`mt-5 grid shrink-0 gap-4 [@media(max-height:540px)]:mt-3 ${selected ? "xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-center xl:gap-x-8" : ""}`}
                >
                    <div className="min-w-0">
                        <h3 className="font-display line-clamp-2 text-[clamp(1.5rem,3.5dvh,2.25rem)] leading-tight font-semibold tracking-tight">
                            {selected?.name || "Find your next stop"}
                        </h3>
                        <p className="text-muted-foreground mt-2 line-clamp-2 max-w-[60ch] text-sm leading-6 [@media(max-height:540px)]:leading-5">
                            {selected?.address ||
                                (isCountry
                                    ? "Pick a city from Cities to explore, then open its guide."
                                    : "Pick a sight from Places to explore, then start a Board from that place.")}
                        </p>
                        {selected && sourceUrl ? (
                            <div className="mt-3 grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-3 md:grid-cols-[8rem_minmax(0,1fr)]">
                                <div className="min-w-0">
                                    <BoardPhoto
                                        image={
                                            selectedInfo?.data?.image
                                                ? {
                                                      id: selected.id,
                                                      url: selectedInfo.data.image.url,
                                                      alt: selectedInfo.data.image.alt,
                                                      source: "application"
                                                  }
                                                : undefined
                                        }
                                        placeholderLabel={selected.name}
                                        sizes="(max-width: 767px) 80px, 128px"
                                        className="h-20 w-full rounded-sm md:h-24"
                                    />
                                    {selectedInfo?.data?.image ? (
                                        <p className="text-muted-foreground mt-1 text-[10px] leading-3">
                                            <a
                                                className="block truncate underline"
                                                href={selectedInfo.data.image.sourceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {selectedInfo.data.image.author}
                                            </a>
                                            <a
                                                className="block truncate underline"
                                                href={selectedInfo.data.image.licenseUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {selectedInfo.data.image.licenseName}
                                            </a>
                                        </p>
                                    ) : null}
                                </div>
                                <div className="min-w-0">
                                    <p
                                        className="text-muted-foreground line-clamp-3 text-xs leading-5 md:text-sm"
                                        role={!selectedInfo ? "status" : undefined}
                                    >
                                        {!selectedInfo
                                            ? `Loading ${itemName} details...`
                                            : selectedInfo.error ||
                                              selectedInfo.data?.description ||
                                              `No description is available for this ${itemName}.`}
                                    </p>
                                    {selectedInfo?.error || selectedInfo?.data?.unavailable.length ? (
                                        <button
                                            type="button"
                                            className="min-h-11 text-xs underline"
                                            onClick={() => {
                                                detailRequests.current.delete(selected.id);
                                                setPlaceInfo(null);
                                                setDetailAttempt((value) => value + 1);
                                            }}
                                        >
                                            Retry {itemName} details
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                        {sourceUrl ? (
                            <p className="text-muted-foreground mt-3 text-[11px] leading-4">
                                <a href={sourceUrl} className="underline">
                                    Wikivoyage contributors
                                </a>
                                {" / "}
                                <a href="https://creativecommons.org/licenses/by-sa/4.0/" className="underline">
                                    CC BY-SA 4.0
                                </a>
                                {!isCountry ? (
                                    <span className="block" role="status">
                                        {mapMatch && mapMatch.id === selected?.id
                                            ? mapMatch.message
                                            : "Finding this sight in Mapbox..."}
                                    </span>
                                ) : null}
                            </p>
                        ) : null}
                    </div>
                    {selected && selectedHref ? (
                        <div>
                            <Link
                                href={selectedHref}
                                className="bg-foreground text-background flex min-h-12 items-center justify-between gap-3 px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4"
                            >
                                <span>{isCountry ? `Explore ${selected.name}` : "Start a board from this place"}</span>
                                <ArrowUpRight size={18} className="shrink-0" aria-hidden="true" />
                            </Link>
                        </div>
                    ) : null}
                </div>
            </section>
        </section>
    );
}
