"use client";

import { collectionHref } from "@/lib/board-collections";
import mapboxgl, { type GeoJSONSource, type GeoJSONSourceSpecification, type Map as MapboxMap } from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import { loadMapboxMapSession, loadProviderConfig } from "@/lib/providers";
import { loadMapDestinations, type MapDestination } from "@/lib/profile";
import ProfileMapBoardLibrary from "./ProfileMapBoardLibrary";
import {
    countryName,
    locationKey,
    profileMapColors,
    selectedMapBoards,
    type ProfileMapSelection
} from "@/lib/profile-map";

const countryFilter = (codes: string[]): mapboxgl.FilterSpecification => [
    "all",
    ["==", ["get", "disputed"], "false"],
    ["any", ["==", ["get", "worldview"], "all"], ["in", "US", ["get", "worldview"]]],
    ["in", ["get", "iso_3166_1_alpha_3"], ["literal", codes]]
];
function cityData(places: MapDestination[]): GeoJSONSourceSpecification["data"] {
    return {
        type: "FeatureCollection",
        features: places.flatMap((place) =>
            place.longitude === null || place.latitude === null
                ? []
                : [
                      {
                          type: "Feature",
                          geometry: { type: "Point", coordinates: [place.longitude, place.latitude] },
                          properties: {
                              locationKey: locationKey(place),
                              saved: place.collection === "saved",
                              boardId: String(place.boardId ?? "")
                          }
                      }
                  ]
        )
    };
}

export default function VisitedWorldMap({
    destinations,
    embedded = false,
    allowSaved = false,
    profileHandle
}: {
    destinations: MapDestination[];
    embedded?: boolean;
    allowSaved?: boolean;
    profileHandle?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapboxMap | null>(null);
    const sessionRequestRef = useRef<Promise<{ publicToken: string }> | null>(null);
    const [token, setToken] = useState<string>();
    const [mapReady, setMapReady] = useState(false);
    const [error, setError] = useState("");
    const [showPublished, setShowPublished] = useState(true);
    const [showSaved, setShowSaved] = useState(true);
    const [savedDestinations, setSavedDestinations] = useState<MapDestination[] | null>(null);
    const [savedError, setSavedError] = useState("");
    const [savedRetry, setSavedRetry] = useState(0);
    const [selection, setSelection] = useState<ProfileMapSelection | null>(null);
    const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
    const hoverTargetRef = useRef<string | null>(null);
    const [tooltipCountry, setTooltipCountry] = useState<string | null>(null);
    const pointerX = useMotionValue(0);
    const pointerY = useMotionValue(0);
    const reducedMotion = useReducedMotion();
    const [highlightedBoard, setHighlightedBoard] = useState<string | null>(null);
    const places = useMemo(
        () => [...(showPublished ? destinations : []), ...(allowSaved && showSaved ? (savedDestinations ?? []) : [])],
        [destinations, showPublished, allowSaved, showSaved, savedDestinations]
    );
    const publishedCountries = useMemo(
        () => [
            ...new Set(
                places
                    .filter((place) => place.collection !== "saved")
                    .flatMap((place) => (place.countryCode ? [place.countryCode] : []))
            )
        ],
        [places]
    );
    const savedCountries = useMemo(
        () => [
            ...new Set(
                places
                    .filter((place) => place.collection === "saved")
                    .flatMap((place) =>
                        place.countryCode && !publishedCountries.includes(place.countryCode) ? [place.countryCode] : []
                    )
            )
        ],
        [places, publishedCountries]
    );
    const points = useMemo(() => cityData(places), [places]);
    const selectedBoards = useMemo(() => selectedMapBoards(places, selection), [places, selection]);
    const countryCodes = useMemo(
        () =>
            [...new Set([...publishedCountries, ...savedCountries])].sort((a, b) =>
                countryName(a).localeCompare(countryName(b))
            ),
        [publishedCountries, savedCountries]
    );
    const destinationOptions = useMemo(
        () =>
            [
                ...new Set(
                    destinations
                        .filter((place) => place.collection !== "saved")
                        .flatMap((place) => (place.countryCode ? [place.countryCode] : []))
                )
            ]
                .map((code) => ({
                    value: "country:" + code,
                    label: countryName(code),
                    selection: { kind: "country" as const, key: code }
                }))
                .sort((a, b) => a.label.localeCompare(b.label)),
        [destinations]
    );
    const activeHighlight = selectedBoards.some((board) => String(board.boardId) === highlightedBoard)
        ? highlightedBoard
        : null;
    const hoverBoards = selectedMapBoards(places, hoveredCountry ? { kind: "country", key: hoveredCountry } : null);
    const selectionTitle =
        selection?.kind === "country"
            ? countryName(selection.key)
            : (selectedBoards[0]?.city ?? selectedBoards[0]?.country);

    useEffect(() => {
        if (!hoveredCountry) return;
        const timer = window.setTimeout(() => setTooltipCountry(hoveredCountry), 300);
        return () => window.clearTimeout(timer);
    }, [hoveredCountry]);

    useEffect(() => {
        if (!allowSaved || !showSaved || savedDestinations) return;
        const request = { active: true };
        void loadMapDestinations("saved", profileHandle)
            .then((result) => {
                if (request.active) {
                    setSavedDestinations(result);
                    setSavedError("");
                }
            })
            .catch(() => {
                if (request.active) setSavedError("Saved board locations could not be loaded.");
            });
        return () => {
            request.active = false;
        };
    }, [allowSaved, showSaved, savedDestinations, savedRetry, profileHandle]);

    useEffect(() => {
        const request = { active: true };
        sessionRequestRef.current ??= loadProviderConfig().then((config) => {
            if (!config.mapbox.configured) throw new Error("Mapbox is not configured. The world map is unavailable.");
            if (!mapboxgl.supported()) throw new Error("Your browser does not support the interactive world map.");
            return loadMapboxMapSession();
        });
        void sessionRequestRef.current
            .then((session) => {
                if (request.active) setToken(session.publicToken);
            })
            .catch((caught: unknown) => {
                if (request.active)
                    setError(caught instanceof Error ? caught.message : "The world map could not be loaded.");
            });
        return () => {
            request.active = false;
        };
    }, []);

    useEffect(() => {
        if (!token || !containerRef.current) return;
        const map = new mapboxgl.Map({
            container: containerRef.current,
            accessToken: token,
            style: "mapbox://styles/mapbox/light-v11",
            projection: "globe",
            center: [10, 20],
            zoom: 1.9,
            minZoom: 0.7
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        map.on("style.load", () => {
            for (const layer of map.getStyle().layers ?? []) {
                if (layer.type === "fill")
                    map.setPaintProperty(layer.id, "fill-color", layer.id.includes("water") ? "#dedede" : "#eeeeee");
                if (layer.type === "line") map.setPaintProperty(layer.id, "line-color", "#c7c7c7");
                if (layer.type === "background") map.setPaintProperty(layer.id, "background-color", "#f4f4f4");
            }
            map.setFog({ color: "#e7e7e7", "high-color": "#d2d2d2", "space-color": "#f4f4f4", "star-intensity": 0 });
        });
        map.on("load", () => {
            map.addSource("profile-countries", { type: "vector", url: "mapbox://mapbox.country-boundaries-v1" });
            const firstLabel = map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
            for (const collection of ["saved", "published"] as const) {
                map.addLayer(
                    {
                        id: `profile-${collection}-countries`,
                        type: "fill",
                        source: "profile-countries",
                        "source-layer": "country_boundaries",
                        filter: countryFilter([]),
                        paint: {
                            "fill-color": profileMapColors[collection],
                            "fill-opacity": 0.78,
                            "fill-outline-color": profileMapColors[collection]
                        }
                    },
                    firstLabel
                );
            }
            map.addLayer(
                {
                    id: "profile-country-outline",
                    type: "line",
                    source: "profile-countries",
                    "source-layer": "country_boundaries",
                    filter: countryFilter([]),
                    paint: { "line-color": "#572a24", "line-width": 2 }
                },
                firstLabel
            );
            map.addSource("profile-points", { type: "geojson", data: cityData([]) });
            for (const collection of ["saved", "published"] as const) {
                const layerId = `profile-${collection}-points`;
                map.addLayer({
                    id: layerId,
                    type: "circle",
                    source: "profile-points",
                    filter: ["==", ["get", "saved"], collection === "saved"],
                    paint: {
                        "circle-radius": 6,
                        "circle-color": profileMapColors[collection],
                        "circle-stroke-color": "#ffffff",
                        "circle-stroke-width": 2
                    }
                });
            }
            map.addLayer({
                id: "profile-highlighted-points",
                type: "circle",
                source: "profile-points",
                filter: ["==", ["get", "boardId"], "__none__"],
                paint: {
                    "circle-radius": 12,
                    "circle-color": ["case", ["get", "saved"], profileMapColors.saved, profileMapColors.published],
                    "circle-stroke-color": "#ffffff",
                    "circle-stroke-width": 3,
                    "circle-radius-transition": { duration: 150 }
                }
            });
            const interactiveLayers = [
                "profile-published-points",
                "profile-saved-points",
                "profile-highlighted-points",
                "profile-published-countries",
                "profile-saved-countries"
            ];
            map.on("click", (event) => {
                const features = map.queryRenderedFeatures(event.point, {
                    layers: interactiveLayers
                }) as unknown as Array<{ properties?: { locationKey?: string; iso_3166_1_alpha_3?: string } }>;
                const location = features.find((feature) => feature.properties?.locationKey)?.properties?.locationKey;
                const country = features.find((feature) => feature.properties?.iso_3166_1_alpha_3)?.properties
                    ?.iso_3166_1_alpha_3;
                setHighlightedBoard(null);
                if (location) setSelection({ kind: "location", key: location });
                else if (country) setSelection({ kind: "country", key: country });
                else setSelection(null);
            });
            map.on("mousemove", (event) => {
                const features = map.queryRenderedFeatures(event.point, {
                    layers: interactiveLayers
                }) as unknown as Array<{ properties?: { iso_3166_1_alpha_3?: string } }>;
                const country =
                    features.find((feature) => feature.properties?.iso_3166_1_alpha_3)?.properties
                        ?.iso_3166_1_alpha_3 ?? null;
                if (hoverTargetRef.current !== country) {
                    hoverTargetRef.current = country;
                    setHoveredCountry(country);
                    setTooltipCountry(null);
                }
                pointerX.set(Math.max(8, Math.min(event.point.x + 14, map.getContainer().clientWidth - 160)));
                pointerY.set(Math.max(8, Math.min(event.point.y + 14, map.getContainer().clientHeight - 96)));
                map.getCanvas().style.cursor = features.length ? "pointer" : "";
            });
            map.on("mouseout", () => {
                setHoveredCountry(null);
                hoverTargetRef.current = null;
                setTooltipCountry(null);
                map.getCanvas().style.cursor = "";
            });
            setMapReady(true);
        });
        map.on("error", () => setError("The world map could not be loaded. Check your connection and try reloading."));
        const observer = new ResizeObserver(() => map.resize());
        observer.observe(containerRef.current);
        return () => {
            observer.disconnect();
            map.remove();
            mapRef.current = null;
        };
    }, [token, pointerX, pointerY]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;
        (map.getSource("profile-points") as GeoJSONSource).setData(points);
        map.setFilter("profile-published-countries", countryFilter(publishedCountries));
        map.setFilter("profile-saved-countries", countryFilter(savedCountries));
    }, [points, mapReady, publishedCountries, savedCountries]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;
        map.setFilter("profile-highlighted-points", ["==", ["get", "boardId"], activeHighlight ?? "__none__"]);
        const code =
            hoveredCountry && countryCodes.includes(hoveredCountry)
                ? hoveredCountry
                : selection?.kind === "country" && countryCodes.includes(selection.key)
                  ? selection.key
                  : null;
        map.setFilter("profile-country-outline", countryFilter(code ? [code] : []));
    }, [activeHighlight, hoveredCountry, selection, countryCodes, mapReady]);

    return (
        <section
            className={embedded ? "w-full min-w-0" : "border-line mt-16 border-t pt-10"}
            aria-label="Board destinations"
        >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Map filters">
                    <button
                        type="button"
                        aria-pressed={showPublished}
                        onClick={() => setShowPublished((shown) => !shown)}
                        className={
                            "rounded-full border px-4 py-2 text-sm transition-colors " +
                            (showPublished
                                ? "text-foreground border-[#b7473e] bg-[#b7473e]/20"
                                : "border-line text-muted-foreground")
                        }
                    >
                        <span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full bg-[#b7473e]" />
                        Published
                    </button>
                    {allowSaved && (
                        <button
                            type="button"
                            aria-pressed={showSaved}
                            onClick={() => setShowSaved((shown) => !shown)}
                            className={
                                "rounded-full border px-4 py-2 text-sm transition-colors " +
                                (showSaved
                                    ? "text-foreground border-[#cb782c] bg-[#cb782c]/20"
                                    : "border-line text-muted-foreground")
                            }
                        >
                            <span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full bg-[#cb782c]" />
                            Saved
                        </button>
                    )}
                </div>
                {destinationOptions.length > 0 && (
                    <label className="text-foreground ml-auto flex flex-wrap items-center gap-2 text-sm">
                        <select
                            aria-label="Select a country"
                            className="border-line bg-background max-w-full rounded border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                            value={
                                destinationOptions.find((option) =>
                                    selection ? option.value === `${selection.kind}:${selection.key}` : false
                                )?.value ?? ""
                            }
                            onChange={(event) => {
                                const nextSelection =
                                    destinationOptions.find((option) => option.value === event.target.value)
                                        ?.selection ?? null;
                                if (nextSelection) setShowPublished(true);
                                setHighlightedBoard(null);
                                setSelection(nextSelection);
                            }}
                        >
                            <option value="">Select a country</option>
                            {destinationOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>
            {allowSaved && showSaved && !savedDestinations && !savedError && (
                <p role="status" className="text-muted-foreground text-sm">
                    Loading saved locations…
                </p>
            )}
            {allowSaved && showSaved && savedError && (
                <p role="alert" className="text-muted-foreground text-sm">
                    {savedError}{" "}
                    <button
                        type="button"
                        className="underline"
                        onClick={() => {
                            setSavedError("");
                            setSavedRetry((value) => value + 1);
                        }}
                    >
                        Retry
                    </button>
                </p>
            )}

            <div className="relative">
                <AnimatePresence>
                    {tooltipCountry && tooltipCountry === hoveredCountry && hoverBoards.length > 0 && (
                        <motion.div
                            key={tooltipCountry}
                            initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reducedMotion ? 0 : 0.16 }}
                            style={{ x: pointerX, y: pointerY }}
                            className="bg-background/95 border-line text-foreground pointer-events-none absolute top-0 left-0 z-10 flex min-h-20 w-36 flex-col justify-center rounded-sm border p-3 text-xs shadow-md"
                        >
                            <p className="font-medium">{countryName(hoveredCountry)}</p>
                            <p className="text-muted-foreground mt-1">
                                {hoverBoards.length} {hoverBoards.length === 1 ? "board" : "boards"} · Click to explore
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div
                    ref={containerRef}
                    className="border-line h-96 w-full overflow-hidden rounded-lg border sm:h-128"
                    aria-label="Interactive grayscale world globe with board locations"
                />
                {!mapReady && !error && (
                    <p
                        role="status"
                        className="text-muted-foreground pointer-events-none absolute inset-0 grid place-items-center text-sm"
                    >
                        Loading world map…
                    </p>
                )}
                {error && !mapReady && (
                    <p
                        role="alert"
                        className="bg-background/95 text-foreground absolute inset-0 grid place-items-center p-6 text-center text-sm"
                    >
                        {error}
                    </p>
                )}
            </div>
            {error && mapReady && (
                <p role="alert" className="text-muted-foreground mt-3 text-sm">
                    {error}
                </p>
            )}
            <AnimatePresence initial={false}>
                {selection && (
                    <motion.div
                        key="profile-map-previews"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                            height: { duration: reducedMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] },
                            opacity: { duration: reducedMotion ? 0 : 0.18 }
                        }}
                        className="overflow-hidden"
                    >
                        <ProfileMapBoardLibrary
                            key={
                                selection.kind +
                                ":" +
                                selection.key +
                                ":" +
                                selectedBoards.map((board) => board.boardId).join(",")
                            }
                            viewAllHref={collectionHref("map", {
                                ...(profileHandle ? { handle: profileHandle } : {}),
                                collection:
                                    showPublished && allowSaved && showSaved
                                        ? "both"
                                        : showPublished
                                          ? "published"
                                          : "saved",
                                ...(selection.kind === "country"
                                    ? { country: selection.key }
                                    : { longitude: selection.key.split(":")[0], latitude: selection.key.split(":")[1] })
                            })}
                            places={selectedBoards}
                            title={selectionTitle ?? "Board locations"}
                            onBoardHighlight={setHighlightedBoard}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
