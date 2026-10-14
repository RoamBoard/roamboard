"use client";

import mapboxgl, {
    type GeoJSONSource,
    type GeoJSONSourceSpecification,
    type Map as MapboxMap,
    type MapLayerMouseEvent
} from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { loadMapboxMapSession, loadProviderConfig } from "@/lib/providers";
import type { MapDestination } from "@/lib/profile";

const countrySourceId = "profile-country-boundaries";
const visitedCountryLayerId = "profile-visited-countries";
const plannedCountryLayerId = "profile-planned-countries";
const citySourceId = "profile-destination-cities";
const visitedCityLayerId = "profile-visited-cities";
const plannedCityLayerId = "profile-planned-cities";
const cityLayerIds = [visitedCityLayerId, plannedCityLayerId];

type ClickedMapFeature = {
    properties?: Record<string, string | boolean>;
    layer?: { id: string };
};

function unique(values: string[]): string[] {
    return [...new Set(values)];
}

function countryFilter(countryCodes: string[]): mapboxgl.FilterSpecification {
    return [
        "all",
        ["==", ["get", "disputed"], "false"],
        [
            "any",
            ["==", ["get", "worldview"], "all"],
            ["in", "US", ["get", "worldview"]]
        ],
        ["in", ["get", "iso_3166_1"], ["literal", countryCodes]]
    ];
}

function cityData(
    destinations: MapDestination[]
): GeoJSONSourceSpecification["data"] {
    return {
        type: "FeatureCollection",
        features: destinations.flatMap((destination) => {
            if (destination.latitude === null || destination.longitude === null)
                return [];
            return [
                {
                    type: "Feature" as const,
                    id: destination.id,
                    geometry: {
                        type: "Point" as const,
                        coordinates: [
                            destination.longitude,
                            destination.latitude
                        ]
                    },
                    properties: {
                        label: destination.city ?? destination.country,
                        country: destination.country,
                        countryCode: destination.countryCode,
                        boardTitle: destination.boardTitle ?? "Board",
                        completed: Boolean(destination.isCompleted)
                    }
                }
            ];
        })
    };
}

function popupForCity(
    event: MapLayerMouseEvent,
    feature: ClickedMapFeature
): void {
    const properties = feature.properties;
    if (!properties) return;
    const status =
        properties.completed === true || properties.completed === "true"
            ? "Visited"
            : "Planned";
    new mapboxgl.Popup({ closeButton: false, offset: 12 })
        .setLngLat(event.lngLat)
        .setText(`${properties.label} · ${status} · ${properties.boardTitle}`)
        .addTo(event.target);
}

function popupForSelection(event: MapLayerMouseEvent): void {
    const features = (event.features ?? []) as unknown as ClickedMapFeature[];
    const cityFeature = features.find(
        (feature) => feature.layer && cityLayerIds.includes(feature.layer.id)
    );
    if (cityFeature) popupForCity(event, cityFeature);
}

export default function VisitedWorldMap({
    destinations
}: {
    destinations: MapDestination[];
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapboxMap | null>(null);
    const sessionRequestRef = useRef<ReturnType<
        typeof loadMapboxMapSession
    > | null>(null);
    const [token, setToken] = useState<string>();
    const [mapReady, setMapReady] = useState(false);
    const [error, setError] = useState("");

    const visitedCountryCodes = useMemo(
        () =>
            unique(
                destinations
                    .filter((destination) => destination.isCompleted)
                    .map((destination) => destination.countryCode)
            ),
        [destinations]
    );
    const plannedCountryCodes = useMemo(
        () =>
            unique(
                destinations
                    .filter(
                        (destination) =>
                            !destination.isCompleted &&
                            !visitedCountryCodes.includes(
                                destination.countryCode
                            )
                    )
                    .map((destination) => destination.countryCode)
            ),
        [destinations, visitedCountryCodes]
    );
    const destinationCities = useMemo(
        () => cityData(destinations),
        [destinations]
    );

    useEffect(() => {
        if (sessionRequestRef.current) return;
        const request = loadProviderConfig().then((config) => {
            if (!config.mapbox.configured)
                throw new Error(
                    "Add a Mapbox public token to the backend to display the world map."
                );
            return loadMapboxMapSession();
        });
        sessionRequestRef.current = request;
        void request
            .then((session) => setToken(session.publicToken))
            .catch((caught: unknown) =>
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "The world map could not be loaded."
                )
            );
    }, []);

    useEffect(() => {
        if (!token || !containerRef.current) return;
        const initialization = window.setTimeout(() => {
            if (!containerRef.current) return;
            mapboxgl.accessToken = token;
            const map = new mapboxgl.Map({
                container: containerRef.current,
                style: "mapbox://styles/mapbox/light-v11",
                projection: "globe",
                center: [10, 20],
                zoom: 1.15,
                minZoom: 0.7
            });
            map.addControl(
                new mapboxgl.NavigationControl({ showCompass: false }),
                "top-right"
            );
            map.on("style.load", () => {
                map.setFog({
                    color: "rgb(231, 231, 231)",
                    "high-color": "rgb(210, 210, 210)",
                    "space-color": "rgb(255, 255, 255)",
                    "star-intensity": 0
                });
            });
            map.on("load", () => {
                map.addSource(countrySourceId, {
                    type: "vector",
                    url: "mapbox://mapbox.country-boundaries-v1"
                });
                map.addLayer({
                    id: plannedCountryLayerId,
                    type: "fill",
                    source: countrySourceId,
                    "source-layer": "country_boundaries",
                    filter: countryFilter([]),
                    paint: {
                        "fill-color": "#e46f45",
                        "fill-opacity": 0.25,
                        "fill-outline-color": "#e46f45"
                    }
                });
                map.addLayer({
                    id: visitedCountryLayerId,
                    type: "fill",
                    source: countrySourceId,
                    "source-layer": "country_boundaries",
                    filter: countryFilter([]),
                    paint: {
                        "fill-color": "#e46f45",
                        "fill-opacity": 0.78,
                        "fill-outline-color": "#8f3c22"
                    }
                });
                map.addSource(citySourceId, {
                    type: "geojson",
                    data: cityData([])
                });
                map.addLayer({
                    id: plannedCityLayerId,
                    type: "circle",
                    source: citySourceId,
                    filter: ["==", ["get", "completed"], false],
                    paint: {
                        "circle-radius": 6,
                        "circle-color": "#ffffff",
                        "circle-stroke-color": "#161616",
                        "circle-stroke-width": 2
                    }
                });
                map.addLayer({
                    id: visitedCityLayerId,
                    type: "circle",
                    source: citySourceId,
                    filter: ["==", ["get", "completed"], true],
                    paint: {
                        "circle-radius": 6,
                        "circle-color": "#161616",
                        "circle-stroke-color": "#ffffff",
                        "circle-stroke-width": 2
                    }
                });
                map.on("click", cityLayerIds, popupForSelection);
                map.on("mouseenter", cityLayerIds, () => {
                    map.getCanvas().style.cursor = "pointer";
                });
                map.on("mouseleave", cityLayerIds, () => {
                    map.getCanvas().style.cursor = "";
                });
                setMapReady(true);
            });
            map.on("error", (event) =>
                setError(
                    event.error?.message ?? "The world map could not be loaded."
                )
            );
            mapRef.current = map;
        }, 0);
        return () => {
            window.clearTimeout(initialization);
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [token]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;
        (map.getSource(citySourceId) as GeoJSONSource | undefined)?.setData(
            destinationCities
        );
        map.setFilter(
            visitedCountryLayerId,
            countryFilter(visitedCountryCodes)
        );
        map.setFilter(
            plannedCountryLayerId,
            countryFilter(plannedCountryCodes)
        );
    }, [destinationCities, mapReady, plannedCountryCodes, visitedCountryCodes]);

    return (
        <section className="border-line mt-16 border-t pt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-10 tracking-label text-graphite font-bold uppercase">
                        Travel footprint
                    </p>
                    <h2 className="font-display text-28 mt-2 font-bold">
                        Places around the world
                    </h2>
                </div>
                <div className="text-12 text-graphite flex gap-4">
                    <span className="flex items-center gap-2">
                        <i className="size-3 rounded-full bg-[#e46f45]" />{" "}
                        Visited
                    </span>
                    <span className="flex items-center gap-2">
                        <i className="size-3 rounded-full border border-[#e46f45] bg-[#e46f45]/25" />{" "}
                        Planned
                    </span>
                </div>
            </div>
            <p className="text-14 text-graphite mt-3 max-w-2xl leading-6">
                Completed Boards fill countries as visited. Planned Board
                destinations stay light. Select a city marker for its details.
            </p>
            {error ? (
                <div
                    className="border-line bg-faint text-14 text-graphite mt-6 grid aspect-[2/1] place-items-center border px-6 text-center"
                    role="alert"
                >
                    {error}
                </div>
            ) : (
                <div
                    ref={containerRef}
                    className="border-line mt-6 h-96 w-full overflow-hidden border sm:h-128"
                    aria-label="Interactive world map of visited and planned destinations"
                />
            )}
            <ul className="text-12 text-graphite mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {destinations.map((destination) => (
                    <li key={destination.id}>
                        {destination.city ?? destination.country} ·{" "}
                        {destination.isCompleted ? "visited" : "planned"}
                    </li>
                ))}
            </ul>
        </section>
    );
}
