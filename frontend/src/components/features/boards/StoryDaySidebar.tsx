"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, MapPin, Maximize2 } from "lucide-react";
import { sceneActivities, type DayScene } from "@/lib/board-story-scenes";
import type { BoardActivity } from "@/types/board";
import type { PublishedBoardDay } from "@/types/published-board";

export default function StoryDaySidebar({
    days,
    scene,
    sceneIds,
    sceneId,
    filter,
    follow,
    map,
    onFilter,
    onFollow,
    onEnlarge,
    onOpen,
    onLocation,
    onHighlight,
    jump
}: {
    days: PublishedBoardDay[];
    scene?: DayScene;
    sceneIds: string[];
    sceneId: string;
    filter: number | "all";
    follow: boolean;
    map: ReactNode;
    onFilter: (day: number | "all") => void;
    onFollow: () => void;
    onEnlarge: () => void;
    onOpen: (activity: BoardActivity) => void;
    onLocation: (activity: BoardActivity) => void;
    onHighlight: (id?: string) => void;
    jump: (id: string) => void;
}) {
    const index = sceneIds.indexOf(sceneId);
    return (
        <aside
            aria-label="Day counter and journey map"
            className="border-line flex min-h-0 flex-col border-r px-5 pt-7 pb-5"
        >
            <div className="mt-5">
                <p className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">
                    {scene ? "The journey" : "At a glance"}
                </p>
                <h2 className={`font-display mt-3 leading-none font-bold ${scene ? "text-6xl" : "text-4xl"}`}>
                    {scene ? (
                        <>
                            Day <span className="tabular-nums">{String(scene.day.number).padStart(2, "0")}</span>
                        </>
                    ) : (
                        "Overview"
                    )}
                </h2>
                <p className="text-muted-foreground mt-3 text-[11px]">
                    {scene
                        ? `Scene ${scene.part} of ${scene.parts} · ${sceneActivities(scene.day).length} activities`
                        : `${days.length} days to explore`}
                </p>
                {scene?.day.date ? (
                    <time dateTime={scene.day.date} className="text-muted-foreground mt-2 text-xs">
                        {scene.day.date}
                    </time>
                ) : null}
            </div>
            <div className="mt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-[10px]">
                        {filter === "all" ? "The whole journey" : `Day ${filter} map`}
                    </span>
                    <button
                        type="button"
                        aria-label="Enlarge journey map"
                        onClick={onEnlarge}
                        className="hover:bg-faint grid size-9 place-items-center"
                    >
                        <Maximize2 size={14} />
                    </button>
                </div>
                {map}
                <div className="mt-2 flex items-center justify-between gap-2">
                    <select
                        aria-label="Map day filter"
                        value={filter}
                        onChange={(event) =>
                            onFilter(event.target.value === "all" ? "all" : Number(event.target.value))
                        }
                        className="border-line bg-background max-w-28 border-b py-2 text-[10px]"
                    >
                        <option value="all">All days</option>
                        {days.map((day) => (
                            <option key={day.number} value={day.number}>
                                Day {day.number}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        aria-pressed={follow}
                        onClick={onFollow}
                        className="min-h-9 text-[10px] underline underline-offset-4"
                    >
                        Follow story
                    </button>
                </div>
            </div>
            <div data-story-inner className="order-first min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                {scene?.day.title ? (
                    <p className="text-muted-foreground mb-5 text-xs leading-relaxed">{scene.day.title}</p>
                ) : null}
                {scene ? (
                    sceneActivities(scene.day).map((activity) => (
                        <div
                            key={activity.id}
                            className="border-line mb-5 border-t pt-3"
                            onMouseEnter={() => onHighlight(activity.id)}
                            onMouseLeave={() => onHighlight(undefined)}
                        >
                            {activity.time ? (
                                <p className="text-muted-foreground mb-1 text-[10px]">{activity.time}</p>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => onOpen(activity)}
                                className="font-display min-h-9 text-left text-lg leading-tight font-semibold hover:underline"
                            >
                                {activity.title}
                            </button>
                            {activity.description ? (
                                <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                                    {Array.from(activity.description).slice(0, 120).join("")}
                                    {Array.from(activity.description).length > 120 ? "…" : ""}
                                </p>
                            ) : null}
                            {activity.location ? (
                                <button
                                    type="button"
                                    onClick={() => onLocation(activity)}
                                    className="text-muted-foreground mt-2 flex min-h-9 items-center gap-1 text-left text-[10px] underline underline-offset-2"
                                >
                                    <MapPin size={12} className="shrink-0" />
                                    {activity.location.name}
                                </button>
                            ) : null}
                        </div>
                    ))
                ) : (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                        A day at a time. Scroll to step into the journey, or choose a chapter above.
                    </p>
                )}
            </div>
            <div className="border-line mt-4 flex items-center justify-between border-t pt-3">
                <button
                    type="button"
                    aria-label="Previous story scene"
                    disabled={index <= 0}
                    onClick={() => jump(sceneIds[index - 1])}
                    className="hover:bg-faint grid size-10 place-items-center disabled:opacity-30"
                >
                    <ArrowLeft size={17} />
                </button>
                <span className="text-muted-foreground text-[10px]">Scroll to explore</span>
                <button
                    type="button"
                    aria-label="Next story scene"
                    onClick={() => jump(sceneIds[index + 1] ?? "ending")}
                    className="hover:bg-faint grid size-10 place-items-center"
                >
                    <ArrowRight size={17} />
                </button>
            </div>
        </aside>
    );
}
