"use client";
import { dayColor } from "@/lib/day-color";

import { useEffect, useMemo, useRef, useState } from "react";
import InteractiveMap from "@/components/features/providers/InteractiveMap";
import { loadMapboxMapSession } from "@/lib/providers";

import type { BoardActivity } from "@/types/board";
import type { PublishedBoardDay } from "@/types/published-board";

const noRoute: Array<[number, number]> = [];

export default function StoryMap({
    days,
    filter,
    activeId,
    onOpen,
    session,
    active = true,
    expanded = false,
    fill = false,
    focusFirst = false,
    userZoom,
    onEnlarge
}: {
    days: PublishedBoardDay[];
    filter: number | "all";
    activeId?: string;
    onOpen: (activity: BoardActivity) => void;
    session: () => ReturnType<typeof loadMapboxMapSession>;
    active?: boolean;
    expanded?: boolean;
    fill?: boolean;
    focusFirst?: boolean;
    userZoom?: { current: number | undefined };
    onEnlarge?: () => void;
}) {
    const container = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    const [token, setToken] = useState<string>();
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const activities = useMemo(
        () =>
            days.flatMap((day, dayIndex) =>
                day.items.flatMap((item, index) =>
                    item.type === "activity" && item.location && (filter === "all" || filter === day.number)
                        ? [
                              {
                                  activity: item,
                                  point: {
                                      id: item.id,
                                      label: item.title,
                                      detail: item.location.address,
                                      latitude: item.location.latitude,
                                      longitude: item.location.longitude,
                                      sequence: index + 1,
                                      color: dayColor(day, dayIndex)
                                  }
                              }
                          ]
                        : []
                )
            ),
        [days, filter]
    );
    const points = useMemo(() => activities.map((item) => item.point), [activities]);
    const [initialCenter] = useState(() =>
        points[0] ? { latitude: points[0].latitude, longitude: points[0].longitude } : undefined
    );
    useEffect(() => {
        const node = container.current;
        if (!node) return;
        const observer = new IntersectionObserver(
            (entries) => {
                setVisible(entries.some((entry) => entry.isIntersecting));
            },
            { rootMargin: "100px" }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        if (!active || !visible || !points.length) return;
        const state = { cancelled: false };
        void session()
            .then((result) => {
                if (!state.cancelled) setToken(result.publicToken);
            })
            .catch(() => {
                if (!state.cancelled) setError(true);
            });
        return () => {
            state.cancelled = true;
        };
    }, [active, visible, points.length, session, attempt]);
    const mapSize = fill ? "h-full w-full" : expanded ? "h-[min(60dvh,32rem)] min-h-72" : "aspect-square w-full";
    return (
        <div ref={container} className={fill ? "relative h-full overflow-hidden" : "relative overflow-hidden"}>
            {!points.length ? (
                <p className={`text-muted-foreground grid place-content-center px-4 text-center text-xs ${mapSize}`}>
                    No saved locations for {filter === "all" ? "this Board" : `Day ${filter}`}.
                </p>
            ) : error ? (
                <div role="alert" className={`grid place-content-center gap-3 px-4 text-center text-xs ${mapSize}`}>
                    <p>The map is unavailable. Board activities remain available.</p>
                    <button
                        type="button"
                        onClick={() => {
                            setError(false);
                            setAttempt((current) => current + 1);
                        }}
                        className="min-h-11 underline"
                    >
                        Retry map
                    </button>
                </div>
            ) : active && token ? (
                <InteractiveMap
                    token={token}
                    fillHeight={fill}
                    points={points}
                    initialCenter={
                        initialCenter ??
                        (points[0] ? { latitude: points[0].latitude, longitude: points[0].longitude } : undefined)
                    }
                    routeGeometry={noRoute}
                    onError={() => setError(true)}
                    onMapClick={onEnlarge ? () => onEnlarge() : undefined}
                    cooperativeGestures
                    selectedPointId={
                        points.some((point) => point.id === activeId)
                            ? activeId
                            : focusFirst
                              ? points[0]?.id
                              : undefined
                    }
                    userZoom={userZoom}
                    className={mapSize}
                    onPointClick={(point) => {
                        const activity = activities.find((item) => item.activity.id === point.id)?.activity;
                        if (activity) onOpen(activity);
                    }}
                />
            ) : (
                <p role="status" className={`text-muted-foreground grid place-content-center text-xs ${mapSize}`}>
                    Loading map…
                </p>
            )}
        </div>
    );
}
