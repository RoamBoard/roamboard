"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import InteractiveMap from "@/components/features/providers/InteractiveMap";
import { loadMapboxMapSession } from "@/lib/providers";
import { dayColors } from "@/types/board-creator";
import type { BoardActivity } from "@/types/board";
import type { PublishedBoardDay } from "@/types/published-board";

const noRoute: Array<[number, number]> = [];

export default function StoryMap({
    days,
    filter,
    activeId,
    onOpen,
    session,
    expanded = false,
    fill = false,
    focusFirst = false,
    onEnlarge
}: {
    days: PublishedBoardDay[];
    filter: number | "all";
    activeId?: string;
    onOpen: (activity: BoardActivity) => void;
    session: () => ReturnType<typeof loadMapboxMapSession>;
    expanded?: boolean;
    fill?: boolean;
    focusFirst?: boolean;
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
                                      color: dayColors[dayIndex % dayColors.length]
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
                if (entries.some((entry) => entry.isIntersecting)) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: "100px" }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        if (!visible || !points.length) return;
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
    }, [visible, points.length, session, attempt]);
    return (
        <div ref={container} className={fill ? "relative h-full overflow-hidden" : "relative overflow-hidden"}>
            {!points.length ? (
                <p
                    className={`text-muted-foreground grid place-content-center px-4 text-center text-xs ${fill ? "h-full w-full" : expanded ? "h-[min(60dvh,32rem)] min-h-72" : "aspect-square w-full"}`}
                >
                    No saved locations for {filter === "all" ? "this Board" : `Day ${filter}`}.
                </p>
            ) : error ? (
                <div
                    role="alert"
                    className={`grid place-content-center gap-3 px-4 text-center text-xs ${fill ? "h-full w-full" : expanded ? "h-[min(60dvh,32rem)] min-h-72" : "aspect-square w-full"}`}
                >
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
            ) : token ? (
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
                    selectedZoom={15}
                    className={
                        fill
                            ? "h-full w-full"
                            : expanded
                              ? "h-[min(60dvh,32rem)] min-h-72 w-full"
                              : "aspect-square w-full"
                    }
                    onPointClick={(point) => {
                        const activity = activities.find((item) => item.activity.id === point.id)?.activity;
                        if (activity) onOpen(activity);
                    }}
                />
            ) : (
                <p
                    role="status"
                    className={`text-muted-foreground grid place-content-center text-xs ${fill ? "h-full w-full" : expanded ? "h-[min(60dvh,32rem)] min-h-72" : "aspect-square w-full"}`}
                >
                    Loading map…
                </p>
            )}
        </div>
    );
}
