/* eslint-disable @next/next/no-img-element */
"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, type CSSProperties, type ReactNode } from "react";
import CollageBoardCard from "./cards/CollageBoardCard";
import type { createBoardPreview } from "@/lib/board-creation-preview";
import type { BoardCreatorPayload } from "@/types/board-creator";

const assets = "/images/create/preview/";
const visibilityLabels = { collaborators: "Collaborators", friends: "Friends", public: "Public" };
const textClass = "text-muted-foreground mt-1 text-xs leading-[1.35] whitespace-pre-wrap [overflow-wrap:anywhere]";
const editClass =
    "hover:text-foreground focus-visible:outline-foreground inline-flex min-h-11 items-start gap-1.5 py-2 underline-offset-4 hover:underline focus-visible:outline-1 focus-visible:outline-offset-4 @min-[1100px]:min-h-0 @min-[1100px]:py-0";

// Coordinates are relative to the 1536px-wide preview chapter in Figma 625:4006.
// The destination elbow is shorter because this Board has no persisted Highlights field.
// Text keeps a fixed readable size, so stems reserve pixel clearance before rejoining scaled endpoints.
const connectors = [
    { asset: "line45", x: 508, y: 101, length: 196, vertical: true, textClearance: 80 },
    { asset: "line44", x: 508, y: 297, length: 80 },
    { asset: "line60", x: 895, y: 136, length: 65, textClearance: 70 },
    { asset: "line59", x: 960, y: 136, length: 113, vertical: true, textClearance: 70 },
    { asset: "line49", x: 1078, y: 274, length: 86, vertical: true, textClearance: 60 },
    { asset: "line44", x: 998, y: 360, length: 80 },
    { asset: "line50", x: 998, y: 415, length: 220 },
    { asset: "line51", x: 1218, y: 254, length: 161, vertical: true },
    { asset: "line52", x: 1218, y: 254, length: 18 },
    { asset: "line47", x: 401, y: 498, length: 25, vertical: true },
    { asset: "line46", x: 401, y: 523, length: 187 },
    { asset: "line53", x: 998, y: 479, length: 166 },
    { asset: "line54", x: 1164, y: 479, length: 50, vertical: true },
    { asset: "line55", x: 1164, y: 529, length: 190 },
    { asset: "line56", x: 992, y: 602, length: 131 },
    { asset: "line57", x: 1123, y: 602, length: 152, vertical: true },
    { asset: "line58", x: 1123, y: 754, length: 106 }
];

function Graphic({ asset, className, style }: { asset: string; className: string; style?: CSSProperties }) {
    return (
        <span
            aria-hidden="true"
            className={`pointer-events-none block ${className}`}
            style={{
                ...style,
                maskImage: `url(${assets}${asset}.svg)`,
                maskRepeat: "no-repeat",
                maskSize: "100% 100%"
            }}
        />
    );
}

function EditMark() {
    return <Graphic asset="vector16" className="mt-0.5 h-[10px] w-[10px] shrink-0 bg-current opacity-70" />;
}

function Callout({
    label,
    href,
    editLabel,
    className,
    children,
    note
}: {
    label: string;
    href: string;
    editLabel: string;
    className: string;
    children: ReactNode;
    note?: string;
}) {
    const reducedMotion = useReducedMotion();
    const valueId = useId();
    return (
        <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: reducedMotion ? 0 : 0.3 }}
            className={`min-w-0 @min-[1100px]:absolute ${className}`}
        >
            <dt className="text-foreground/80 text-sm leading-tight font-bold">{label}</dt>
            <dd className={textClass}>
                <a href={href} aria-label={editLabel} aria-describedby={valueId} className={editClass}>
                    <span id={valueId} className="min-w-0">
                        {children}
                    </span>
                    <EditMark />
                </a>
            </dd>
            {note ? <dd className="text-muted-foreground mt-2 text-[10px] leading-snug">{note}</dd> : null}
        </motion.div>
    );
}

const photoSlots = [
    { left: 0, top: 6.62, width: 48.98, height: 35.66 },
    { left: 0, top: 43.38, width: 48.98, height: 26.47 },
    { left: 0, top: 70.59, width: 48.98, height: 29.41 },
    { left: 52.04, top: 0, width: 47.96, height: 22.43 },
    { left: 52.04, top: 23.9, width: 47.96, height: 29.04 },
    { left: 52.04, top: 54.04, width: 47.96, height: 26.47 }
];

export default function BoardPreviewDiagram({
    board,
    preview
}: {
    board: BoardCreatorPayload;
    preview: ReturnType<typeof createBoardPreview>;
}) {
    const reducedMotion = useReducedMotion();
    return (
        <div className="relative grid min-w-0 grid-cols-2 items-start gap-x-6 gap-y-8 @min-[1100px]:block @min-[1100px]:h-[69.27cqw]">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden @min-[1100px]:block">
                {connectors.map((line, index) => (
                    <motion.div
                        key={index}
                        initial={reducedMotion ? false : { scaleX: 0, opacity: 0 }}
                        whileInView={{ scaleX: 1, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{
                            duration: reducedMotion ? 0 : 0.35,
                            delay: reducedMotion ? 0 : Math.min(index * 0.012, 0.1)
                        }}
                        className="absolute h-[0.5px]"
                        style={{
                            left: `${(line.x / 1536) * 100}%`,
                            top: `calc(${(line.y / 1536) * 100}cqw + ${line.textClearance ?? 0}px)`,
                            width: `max(0px, calc(${(line.length / 1536) * 100}cqw - ${line.vertical ? (line.textClearance ?? 0) : 0}px))`,
                            rotate: line.vertical ? 90 : 0,
                            transformOrigin: "0 0"
                        }}
                    >
                        <Graphic asset={line.asset} className="bg-foreground/30 h-full w-full" />
                    </motion.div>
                ))}
            </div>
            <motion.figure
                layout={reducedMotion ? false : "position"}
                initial={false}
                className="relative order-2 col-span-2 mx-auto w-full max-w-[320px] @min-[1100px]:absolute @min-[1100px]:top-[16.536cqw] @min-[1100px]:left-[37.826%] @min-[1100px]:m-0 @min-[1100px]:w-[28.646%] @min-[1100px]:max-w-none"
            >
                <CollageBoardCard board={preview.card} preview annotatedPreview />
                <Graphic
                    asset="vector14"
                    className="bg-foreground/65 absolute top-[2.159%] left-[84.09%] h-[19px] w-[19px]"
                />
                <figcaption className="sr-only">
                    Live Board preview. {preview.card.images.length} photos shown in the collage; all photos remain
                    available below.
                </figcaption>
            </motion.figure>
            <dl className="contents">
                <Callout
                    label="Title"
                    href="#board-title"
                    editLabel="Edit title"
                    className="order-1 col-span-2 @min-[1100px]:top-[6.576cqw] @min-[1100px]:left-[30.078%] @min-[1100px]:w-[16%]"
                >
                    <span className="block max-h-12 overflow-y-auto">{preview.card.title}</span>
                </Callout>
                <Callout
                    label="Visibility"
                    href="#details-discovery"
                    editLabel="Edit visibility"
                    className="order-3 @min-[1100px]:top-[8.854cqw] @min-[1100px]:left-[54.557%] @min-[1100px]:w-[16%]"
                    note="Drafts are visible only to you."
                >
                    {visibilityLabels[board.visibility]} when published
                </Callout>
                <Callout
                    label="Dates"
                    href="#day-plan"
                    editLabel="Review dates in the day plan"
                    className="order-3 @min-[1100px]:top-[17.839cqw] @min-[1100px]:left-[68.49%] @min-[1100px]:w-[13%]"
                >
                    <span className="block max-h-16 overflow-y-auto">{preview.dateLabel}</span>
                </Callout>
                <div className="order-4 col-span-2 min-w-0 @min-[1100px]:absolute @min-[1100px]:top-[15.104cqw] @min-[1100px]:left-[21.615%] @min-[1100px]:w-[6.38%]">
                    <dt className="text-foreground/80 text-sm leading-none font-bold @min-[1100px]:text-right">
                        Board
                        <br className="hidden @min-[1100px]:block" /> photos
                    </dt>
                    <dd className="mt-3 flex items-start gap-4 @min-[1100px]:mt-1 @min-[1100px]:block">
                        <a
                            href="#board-images"
                            aria-label="Manage photos"
                            className="group relative block aspect-[98/272] w-[98px] shrink-0 focus-visible:outline-1 focus-visible:outline-offset-4 @min-[1100px]:w-full"
                        >
                            {photoSlots.map((slot, index) => (
                                <span
                                    key={index}
                                    className="absolute overflow-hidden"
                                    style={{
                                        left: `${slot.left}%`,
                                        top: `${slot.top}%`,
                                        width: `${slot.width}%`,
                                        height: `${slot.height}%`
                                    }}
                                >
                                    {preview.card.images[index] ? (
                                        <img
                                            src={preview.card.images[index].src}
                                            alt=""
                                            loading="lazy"
                                            className="h-full w-full object-cover transition-opacity group-hover:opacity-80 motion-reduce:transition-none"
                                        />
                                    ) : (
                                        <span
                                            aria-hidden="true"
                                            className="border-line/35 block h-full w-full border"
                                        />
                                    )}
                                </span>
                            ))}
                            <Graphic
                                asset="vector15"
                                className={`absolute top-[22%] left-[19%] h-[11px] w-[11px] ${preview.card.images.length ? "bg-white drop-shadow-sm" : "bg-foreground/70 group-hover:bg-foreground"}`}
                            />
                        </a>
                        <span className="text-muted-foreground mt-2 max-w-40 text-[10px] leading-snug @min-[1100px]:block">
                            {preview.cover ? "Selected cover first" : "No Board cover selected"}
                            <br />
                            {preview.photos.length} {preview.photos.length === 1 ? "photo" : "photos"} available
                        </span>
                    </dd>
                </div>
                <Callout
                    label="Description"
                    href="#board-basics"
                    editLabel="Edit description"
                    className="order-5 col-span-2 @min-[1100px]:top-[13.542cqw] @min-[1100px]:left-[81.12%] @min-[1100px]:w-[11%]"
                >
                    <span className="block max-h-36 overflow-y-auto">
                        {board.description.trim() || "No description yet."}
                    </span>
                </Callout>
                <Callout
                    label="Tags"
                    href="#details-discovery"
                    editLabel="Edit details"
                    className="order-6 @min-[1100px]:top-[30.273cqw] @min-[1100px]:left-[88.802%] @min-[1100px]:w-[11.198%]"
                >
                    {board.tags.length ? (
                        <span className="grid gap-2">
                            {board.tags.map((tag) => (
                                <span key={tag} className="border-line border-l pl-2">
                                    {tag}
                                </span>
                            ))}
                        </span>
                    ) : (
                        "None selected"
                    )}
                </Callout>
                <Callout
                    label="Destination"
                    href="#day-plan"
                    editLabel="Edit places in the day plan"
                    className="order-7 @min-[1100px]:top-[47.526cqw] @min-[1100px]:left-[80.664%] @min-[1100px]:w-[16%]"
                    note="From confirmed places in your day plan."
                >
                    <span className="block max-h-24 overflow-y-auto">{preview.destination}</span>
                </Callout>
            </dl>
        </div>
    );
}
