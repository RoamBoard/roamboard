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
    sequence?: number;
};

type Props = {
    token?: string;
    cooperativeGestures?: boolean;
    className?: string;
    points: MapPoint[];
    routeGeometry: Array<[number, number]>;
    onMapClick?: (latitude: number, longitude: number) => void;
    onPointClick?: (point: MapPoint) => void;
    selectedPointId?: string;
    initialCenter?: { latitude: number; longitude: number };
    initialZoom?: number;
    selectedZoom?: number;
    fillHeight?: boolean;
    scrollZoom?: boolean;
};

const routeSource = "roamboard-provider-route";

export default function InteractiveMap({
    token,
    points,
    routeGeometry,
    onMapClick,
    onPointClick,
    selectedPointId,
    initialCenter,
    initialZoom = 11,
    selectedZoom = 14,
    fillHeight = false,
    scrollZoom = true,
    cooperativeGestures = false,
    className
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapboxMap | null>(null);
    const markersRef = useRef<Marker[]>([]);
    const onMapClickRef = useRef(onMapClick);
    const onPointClickRef = useRef(onPointClick);
    const [mapError, setMapError] = useState("");
    const [mapReady, setMapReady] = useState(false);
    const initialLatitude = initialCenter?.latitude ?? 59.3293;
    const initialLongitude = initialCenter?.longitude ?? 18.0686;

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
                center: [initialLongitude, initialLatitude],
                zoom: initialZoom,
                cooperativeGestures
            });
            if (!scrollZoom) map.scrollZoom.disable();
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
                map.on("click", (event) => onMapClickRef.current?.(event.lngLat.lat, event.lngLat.lng));
            }
            map.on("error", (event) => setMapError(event.error?.message ?? "The Mapbox map could not load."));
            mapRef.current = map;
        }, 0);
        return () => {
            window.clearTimeout(initialization);
            markersRef.current.forEach((marker) => marker.remove());
            markersRef.current = [];
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [token, scrollZoom, initialLatitude, initialLongitude, initialZoom, cooperativeGestures]);

    useEffect(() => {
        markersRef.current.forEach((marker) => marker.remove());
        const map = mapRef.current;
        if (!map || !mapReady) return;
        markersRef.current = points.map((point, index) => {
            const element = document.createElement("div");
            // Mapbox positions the outer element with a transform; rotate only the inner pin.
            const pin = document.createElement("div");
            pin.className = "provider-map-pin";
            if (point.color) pin.style.backgroundColor = point.color;
            const label = document.createElement("span");
            label.textContent = String(point.sequence ?? index + 1);
            pin.append(label);
            element.append(pin);
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
            const position = colocated.findIndex((candidate) => candidate.id === point.id);
            const angle = (position / colocated.length) * Math.PI * 2;
            const offset: [number, number] =
                colocated.length > 1 ? [Math.cos(angle) * 22, Math.sin(angle) * 22] : [0, 0];
            return new mapboxgl.Marker({ element, offset }).setLngLat([point.longitude, point.latitude]).addTo(map);
        });
        if (points.length === 1 && points[0]) {
            map.easeTo({
                center: [points[0].longitude, points[0].latitude],
                zoom: 13
            });
        }
        if (points.length > 1) {
            const bounds = points.reduce(
                (current, point) => current.extend([point.longitude, point.latitude]),
                new mapboxgl.LngLatBounds()
            );
            map.fitBounds(bounds, { padding: 64, maxZoom: 14 });
        }
    }, [points, mapReady]);

    useEffect(() => {
        const point = points.find((item) => item.id === selectedPointId);
        if (!mapReady) return;
        // Keep every marker visible while centering the selected sight. Other map users retain their old behavior.
        markersRef.current.forEach((marker, index) => {
            const selected = points[index]?.id === selectedPointId;
            const element = marker.getElement();
            if (onPointClickRef.current) element.setAttribute("aria-pressed", String(selected));
            const pin = element.querySelector<HTMLElement>(".provider-map-pin");
            if (pin) {
                pin.style.backgroundColor = selected ? "#e7e7e7" : (points[index]?.color ?? "#161616");
                pin.style.color = selected ? "#161616" : "#ffffff";
                pin.style.borderColor = selected ? "#161616" : "#ffffff";
            }
        });
        if (!point) return;
        mapRef.current?.easeTo({ center: [point.longitude, point.latitude], zoom: selectedZoom });
    }, [selectedPointId, points, mapReady, selectedZoom]);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(() => mapRef.current?.resize());
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const source = mapRef.current?.getSource(routeSource) as mapboxgl.GeoJSONSource | undefined;
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
        <div className={fillHeight ? "relative h-full min-h-0" : "relative"}>
            <div
                ref={containerRef}
                className={className ?? (fillHeight ? "h-full w-full" : "h-96 w-full sm:h-120")}
                aria-label="Interactive Mapbox map"
            />
            {mapError ? (
                <p className="text-12 text-foreground absolute right-3 bottom-3 left-3 bg-white/95 p-3" role="alert">
                    {mapError}
                </p>
            ) : null}
        </div>
    );
}
