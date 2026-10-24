"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Minimize2 } from "lucide-react";
import InteractiveMap from "@/components/features/providers/InteractiveMap";
import { loadMapboxMapSession, reverseBoardLocationProvider } from "@/lib/providers";
import type { PinLocation } from "@/types/board-creator";

const noRoute: Array<[number, number]> = [];

export default function ActivityPinMap({
    location,
    proximity,
    disabled,
    editVersion = 0,
    onChange
}: {
    location: PinLocation | null;
    proximity?: { latitude: number; longitude: number } | null;
    disabled?: boolean;
    editVersion?: number;
    onChange: (location: PinLocation | null) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [token, setToken] = useState<string>();
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const requestRef = useRef({ version: 0 });
    const latest = useRef(location);
    useEffect(() => {
        latest.current = location;
    }, [location]);
    const [center] = useState(location ?? proximity ?? undefined);
    useEffect(() => {
        const controller = new AbortController();
        const requestState = requestRef.current;
        void loadMapboxMapSession(controller.signal)
            .then((session) => {
                if (!controller.signal.aborted) setToken(session.publicToken);
            })
            .catch(() => {
                if (!controller.signal.aborted)
                    setError("Map unavailable. Search for a place or keep this activity without a pin.");
            });
        return () => {
            controller.abort();
            requestState.version++;
        };
    }, [retry]);
    useEffect(() => {
        requestRef.current.version++;
    }, [editVersion]);
    async function place(latitude: number, longitude: number) {
        if (disabled) return;
        const version = ++requestRef.current.version;
        const pin: PinLocation = {
            name: "",
            address: "",
            latitude,
            longitude,
            country: null,
            countryCode: null,
            city: null,
            mapboxId: null
        };
        onChange(pin);
        setError("");
        try {
            const suggestion = await reverseBoardLocationProvider(String(latitude), String(longitude), true);
            if (
                version !== requestRef.current.version ||
                !suggestion ||
                !latest.current ||
                latest.current.latitude !== latitude ||
                latest.current.longitude !== longitude ||
                latest.current.name
            )
                return;
            onChange({
                ...pin,
                name: suggestion.detail || suggestion.label,
                address: suggestion.address ?? "",
                country: suggestion.country ?? null,
                countryCode: suggestion.countryCode ?? null,
                city: suggestion.city ?? null
            });
        } catch {
            if (version === requestRef.current.version)
                setError("Place lookup unavailable. Your pin is kept; give it a name below.");
        }
    }
    return (
        <section
            className="border-line mt-5 overflow-hidden rounded-2xl border"
            aria-label="Activity location map"
            data-map-interactive={expanded}
            onKeyDown={(event) => {
                if (event.key === "Escape" && expanded) {
                    event.stopPropagation();
                    setExpanded(false);
                }
            }}
        >
            <div className="bg-faint relative" style={{ height: expanded ? 380 : 180 }}>
                {token ? (
                    <InteractiveMap
                        token={token}
                        initialCenter={center}
                        points={
                            location
                                ? [
                                      {
                                          id: "activity-pin",
                                          label: location.name || "Name this pin",
                                          latitude: location.latitude,
                                          longitude: location.longitude
                                      }
                                  ]
                                : []
                        }
                        routeGeometry={noRoute}
                        scrollZoom={expanded}
                        cooperativeGestures
                        fillHeight
                        onMapClick={place}
                        onPointDrag={
                            !disabled ? (_id, latitude, longitude) => void place(latitude, longitude) : undefined
                        }
                    />
                ) : (
                    <p role="status" className="p-5 text-xs">
                        {error || "Loading map…"}
                    </p>
                )}
                <button
                    type="button"
                    disabled={disabled}
                    aria-label={expanded ? "Minimize activity map" : "Expand activity map"}
                    onClick={() => {
                        setExpanded(!expanded);
                    }}
                    className="bg-background absolute top-3 left-3 grid size-10 place-items-center rounded-full shadow-sm"
                >
                    {expanded ? <Minimize2 size={16} /> : <Expand size={16} />}
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-4 py-2">
                <p className="text-muted-foreground text-xs">Click the map to place or move a pin.</p>
                {location ? (
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                            requestRef.current.version++;
                            onChange(null);
                        }}
                        className="ml-auto min-h-10 text-xs underline"
                    >
                        Remove pin
                    </button>
                ) : null}
                {error ? (
                    <p role="status" className="w-full text-xs">
                        {error}{" "}
                        {!token ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setError("");
                                    setRetry(retry + 1);
                                }}
                                className="underline"
                            >
                                Retry map
                            </button>
                        ) : null}
                    </p>
                ) : null}
            </div>
        </section>
    );
}
