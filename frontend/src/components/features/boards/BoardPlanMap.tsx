"use client";
import { useEffect, useMemo, useState } from "react";
import CreatorSectionIntro from "./CreatorSectionIntro";
import { MapPin } from "lucide-react";
import InteractiveMap from "@/components/features/providers/InteractiveMap";
import { loadMapboxMapSession } from "@/lib/providers";
import { dayColors, type BoardDayDraft } from "@/types/board-creator";
const noRoute: Array<[number, number]> = [];

export default function BoardPlanMap({
    days,
    onOpenActivity
}: {
    days: BoardDayDraft[];
    onOpenActivity: (id: string) => void;
}) {
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [token, setToken] = useState<string>();
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const activeDay = days.some((day) => day.id === selectedDay) ? selectedDay : null;
    const hasPlaces = days.some((day) => day.pins.some((activity) => activity.location));
    const points = useMemo(
        () =>
            days.flatMap((day, index) =>
                activeDay && day.id !== activeDay
                    ? []
                    : day.pins.flatMap((activity, sequence) =>
                          activity.location
                              ? [
                                    {
                                        id: activity.id,
                                        label: activity.title,
                                        detail: activity.location.address,
                                        type: activity.category,
                                        latitude: activity.location.latitude,
                                        longitude: activity.location.longitude,
                                        color: dayColors[index % dayColors.length],
                                        sequence: sequence + 1
                                    }
                                ]
                              : []
                      )
            ),
        [days, activeDay]
    );
    useEffect(() => {
        if (!hasPlaces) return;
        const controller = new AbortController();
        void loadMapboxMapSession(controller.signal)
            .then((session) => {
                if (!controller.signal.aborted) setToken(session.publicToken);
            })
            .catch(() => {
                if (!controller.signal.aborted)
                    setError("The map is unavailable right now. Your activities remain in the day plan.");
            });
        return () => controller.abort();
    }, [hasPlaces, retry]);
    return (
        <section aria-label="Board map" className="border-line border-t pt-8">
            <CreatorSectionIntro
                number="03"
                title="MAP"
                description="Explore your days by colour. Select an activity on the map to view or edit it."
            />
            <div role="group" aria-label="Show activities by day" className="mb-5 flex flex-wrap gap-2">
                <button
                    type="button"
                    aria-pressed={!activeDay}
                    onClick={() => setSelectedDay(null)}
                    className="border-line aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background min-h-10 rounded-full border px-4 text-xs"
                >
                    All days
                </button>
                {days.map((day, index) => (
                    <button
                        key={day.id}
                        type="button"
                        aria-pressed={activeDay === day.id}
                        onClick={() => setSelectedDay(day.id)}
                        className="border-line aria-pressed:border-foreground inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-xs"
                    >
                        <span
                            aria-hidden="true"
                            className="size-2 rounded-full"
                            style={{ backgroundColor: dayColors[index % dayColors.length] }}
                        />
                        Day {day.dayNumber}
                    </button>
                ))}
            </div>
            <div className="bg-faint relative overflow-hidden rounded-[1.25rem]">
                {!points.length ? (
                    <div className="text-muted-foreground grid min-h-64 place-content-center justify-items-center gap-4 px-6 text-center">
                        <MapPin aria-hidden="true" className="size-7" strokeWidth={1} />
                        <p className="text-sm">
                            {hasPlaces ? "No locations on this day yet." : "Your activities will take shape here."}
                        </p>
                        <p className="max-w-sm text-xs leading-relaxed">
                            Choose a location when adding an activity to see it on the map.
                        </p>
                    </div>
                ) : error ? (
                    <div role="alert" className="grid min-h-64 place-content-center gap-4 px-6 text-center">
                        <p className="text-sm">{error}</p>
                        <button
                            type="button"
                            onClick={() => {
                                setError("");
                                setRetry((current) => current + 1);
                            }}
                            className="min-h-11 text-xs underline underline-offset-4"
                        >
                            Try loading the map again
                        </button>
                    </div>
                ) : token ? (
                    <InteractiveMap
                        token={token}
                        points={points}
                        routeGeometry={noRoute}
                        cooperativeGestures
                        className="aspect-[16/9] min-h-56 w-full sm:min-h-80"
                        onPointClick={(point) => onOpenActivity(point.id)}
                    />
                ) : (
                    <div role="status" className="text-muted-foreground grid min-h-64 place-items-center text-sm">
                        Loading your map...
                    </div>
                )}
            </div>
            {points.length ? (
                <p className="text-muted-foreground mt-3 text-[11px]">
                    Numbers show activity order within each day. Use Ctrl-scroll or the map controls to zoom.
                </p>
            ) : null}
        </section>
    );
}
