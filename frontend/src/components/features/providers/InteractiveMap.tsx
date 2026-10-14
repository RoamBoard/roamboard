"use client";

import mapboxgl, { type Map as MapboxMap, type Marker } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

export type MapPoint = {
    id: string;
    label: string;
    detail?: string;
    type?: string;
    latitude: number;
    longitude: number;
    color?: string;
};

type Props = {
    token?: string;
    points: MapPoint[];
    routeGeometry: Array<[number, number]>;
    onMapClick?: (latitude: number, longitude: number) => void;
    onPointClick?: (point: MapPoint) => void;
};

const routeSource = "roamboard-provider-route";

export default function InteractiveMap({
    token,
    points,
    routeGeometry,
    onMapClick,
    onPointClick
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapboxMap | null>(null);
    const markersRef = useRef<Marker[]>([]);
    const onMapClickRef = useRef(onMapClick);
    const onPointClickRef = useRef(onPointClick);
    const [mapError, setMapError] = useState("");
    const [mapReady, setMapReady] = useState(false);

    useEffect(() => {
        onMapClickRef.current = onMapClick;
    }, [onMapClick]);

    useEffect(() => {
        onPointClickRef.current = onPointClick;
    }, [onPointClick]);

    useEffect(() => {
        if (!token || !containerRef.current) return;
        setMapReady(false);
        const initialization = window.setTimeout(() => {
            if (!containerRef.current) return;
            mapboxgl.accessToken = token;
            const map = new mapboxgl.Map({
                container: containerRef.current,
                style: "mapbox://styles/mapbox/streets-v12",
                center: [18.0686, 59.3293],
                zoom: 11
            });
            map.addControl(new mapboxgl.NavigationControl(), "top-right");
            map.on("load", () => {
                map.addSource(routeSource, {
                    type: "geojson",
                    data: {
                        type: "Feature",
                        properties: {},
                        geometry: { type: "LineString", coordinates: [] }
                    }
                });
                map.addLayer({
                    id: routeSource,
                    type: "line",
                    source: routeSource,
                    paint: {
                        "line-color": "#161616",
                        "line-width": 4,
                        "line-opacity": 0.8
                    }
                });
                setMapReady(true);
            });
            if (onMapClickRef.current) {
                map.on("click", (event) =>
                    onMapClickRef.current?.(event.lngLat.lat, event.lngLat.lng)
                );
            }
            map.on("error", (event) =>
                setMapError(
                    event.error?.message ?? "The Mapbox map could not load."
                )
            );
            mapRef.current = map;
        }, 0);
        return () => {
            window.clearTimeout(initialization);
            markersRef.current.forEach((marker) => marker.remove());
            markersRef.current = [];
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [token]);

    useEffect(() => {
        markersRef.current.forEach((marker) => marker.remove());
        const map = mapRef.current;
        if (!map || !mapReady) return;
        markersRef.current = points.map((point, index) => {
            const element = document.createElement("div");
            element.className = "provider-map-pin";
            if (point.color) element.style.backgroundColor = point.color;
            const label = document.createElement("span");
            label.textContent = String(index + 1);
            element.append(label);
            element.title = point.label;
            if (onPointClickRef.current) {
                element.setAttribute("role", "button");
                element.setAttribute("tabindex", "0");
                element.setAttribute("aria-label", `Open ${point.label}`);
                const activate = () => onPointClickRef.current?.(point);
                element.addEventListener("click", (event) => {
                    event.stopPropagation();
                    activate();
                });
                element.addEventListener("keydown", (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        activate();
                    }
                });
            }
            const colocated = points.filter(
                (candidate) =>
                    Math.abs(candidate.latitude - point.latitude) < 0.00001 &&
                    Math.abs(candidate.longitude - point.longitude) < 0.00001
            );
            const position = colocated.findIndex(
                (candidate) => candidate.id === point.id
            );
            const angle = (position / colocated.length) * Math.PI * 2;
            const offset: [number, number] =
                colocated.length > 1
                    ? [Math.cos(angle) * 22, Math.sin(angle) * 22]
                    : [0, 0];
            return new mapboxgl.Marker({ element, offset })
                .setLngLat([point.longitude, point.latitude])
                .addTo(map);
        });
        if (points.length === 1 && points[0]) {
            map.easeTo({
                center: [points[0].longitude, points[0].latitude],
                zoom: 13
            });
        }
        if (points.length > 1) {
            const bounds = points.reduce(
                (current, point) =>
                    current.extend([point.longitude, point.latitude]),
                new mapboxgl.LngLatBounds()
            );
            map.fitBounds(bounds, { padding: 64, maxZoom: 14 });
        }
    }, [points, mapReady]);

    useEffect(() => {
        const source = mapRef.current?.getSource(routeSource) as
            mapboxgl.GeoJSONSource | undefined;
        if (!source) return;
        source.setData({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: routeGeometry }
        });
    }, [routeGeometry, mapReady]);

    if (!token)
        return (
            <div className="border-line bg-faint text-14 text-graphite grid aspect-video place-items-center border px-6 text-center">
                Add a public Mapbox `pk.` token to enable the interactive map.
            </div>
        );
    return (
        <div className="relative">
            <div
                ref={containerRef}
                className="h-96 w-full sm:h-120"
                aria-label="Interactive Mapbox map"
            />
            {mapError ? (
                <p
                    className="text-12 text-foreground absolute right-3 bottom-3 left-3 bg-white/95 p-3"
                    role="alert"
                >
                    {mapError}
                </p>
            ) : null}
        </div>
    );
}
