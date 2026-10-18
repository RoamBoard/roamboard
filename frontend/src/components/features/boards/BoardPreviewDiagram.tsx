"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import PhotoBoardCard from "./cards/PhotoBoardCard";
import type { createBoardPreview } from "@/lib/board-creation-preview";

type Field = "title" | "cover" | "destination" | "tags" | "duration";
type View = "cover" | "details";
type Connector = { field: Field; path: string; x: number; y: number };
type Preview = ReturnType<typeof createBoardPreview>;
type EditSource = { href: string; section: string; control?: string; label: string };

const sources: Partial<Record<Field, EditSource>> = {
    title: { href: "#board-title", section: "board-title", label: "Edit title" },
    cover: {
        href: "#board-images",
        section: "board-images",
        control:
            'button[aria-label="Edit Board cover"]:not(:disabled), button[aria-label="Choose Board images"]:not(:disabled), button[data-board-cover-choice]:not(:disabled)',
        label: "Manage photos"
    },
    tags: {
        href: "#details-discovery",
        section: "board-tags",
        control: "input:not(:disabled), ul button:not(:disabled), button:not(:disabled)",
        label: "Edit details"
    },
    destination: {
        href: "#day-plan",
        section: "day-plan",
        label: "Edit places in the day plan",
        control: 'button[aria-label^="Edit "]:not(:disabled), button[aria-label^="Add activity"]:not(:disabled)'
    }
};
const mainDestinationSource: EditSource = {
    href: "#board-destination",
    section: "board-destination",
    control: 'input[role="combobox"]:not(:disabled)',
    label: "Edit main destination"
};

function EditMark() {
    return (
        <span
            aria-hidden="true"
            className="size-2.5 shrink-0 bg-current opacity-60"
            style={{
                maskImage: "url(/images/create/preview/vector16.svg)",
                maskRepeat: "no-repeat",
                maskSize: "contain"
            }}
        />
    );
}

function Callout({
    field,
    label,
    editable,
    children,
    className = "",
    setActive,
    elementRef,
    sourceOverride
}: {
    field: Field;
    label: string;
    editable: boolean;
    children: ReactNode;
    className?: string;
    setActive: (field: Field | null) => void;
    elementRef: (element: HTMLDivElement | null) => void;
    sourceOverride?: EditSource;
}) {
    const reducedMotion = useReducedMotion();
    const valueId = useId();
    const source = editable ? (sourceOverride ?? sources[field]) : undefined;
    function navigate(event: MouseEvent<HTMLAnchorElement>) {
        if (!source || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        const section = document.getElementById(source.section);
        if (!section) return;
        event.preventDefault();
        const target = (source.control ? section.querySelector<HTMLElement>(source.control) : section) ?? section;
        target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
        target.focus({ preventScroll: true });
    }
    return (
        <motion.div
            ref={elementRef}
            initial={reducedMotion ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: reducedMotion ? 0 : 0.35 }}
            onPointerEnter={() => setActive(field)}
            onPointerLeave={() => setActive(null)}
            onFocusCapture={() => setActive(field)}
            onBlurCapture={() => setActive(null)}
            className={`relative z-20 max-w-44 min-w-0 ${className}`}
        >
            <dt className="text-foreground/80 text-xs font-medium">
                {source ? (
                    <a
                        href={source.href}
                        onClick={navigate}
                        aria-label={source.label}
                        aria-describedby={valueId}
                        className="hover:text-foreground focus-visible:outline-foreground inline-flex min-h-11 items-center gap-2 underline-offset-4 transition-colors hover:underline focus-visible:outline-1 focus-visible:outline-offset-4 motion-reduce:transition-none"
                    >
                        {label}
                        <EditMark />
                    </a>
                ) : (
                    <span className="flex min-h-11 items-center">{label}</span>
                )}
            </dt>
            <dd id={valueId} className="text-muted-foreground text-xs leading-relaxed [overflow-wrap:anywhere]">
                {children}
            </dd>
        </motion.div>
    );
}

function PreviewView({
    view,
    photo,
    children,
    elementRef
}: {
    view: View;
    photo: Preview["photo"];
    children: ReactNode;
    elementRef: (element: HTMLElement | null) => void;
}) {
    const headingId = useId();
    return (
        <section aria-labelledby={headingId} className="grid min-w-0 content-start gap-5 @min-[1100px]:contents">
            <figure
                ref={elementRef}
                aria-labelledby={headingId}
                className={`mx-auto w-full max-w-[340px] @min-[1100px]:row-start-1 ${view === "cover" ? "@min-[1100px]:col-start-2" : "@min-[1100px]:col-start-3"}`}
            >
                <figcaption className="mb-5 flex items-center gap-4">
                    <h3
                        id={headingId}
                        className="text-muted-foreground shrink-0 text-[10px] leading-normal font-medium tracking-[.18em]"
                    >
                        {view === "cover" ? "COVER VIEW" : "DETAILS VIEW"}
                    </h3>
                    <span aria-hidden="true" className="bg-line/65 h-px flex-1" />
                </figcaption>
                <PhotoBoardCard board={photo} presentation={view} imageSizes="(max-width: 480px) 80vw, 340px" />
            </figure>
            <dl
                className={`grid grid-cols-2 items-start gap-x-6 gap-y-4 @min-[1100px]:row-start-1 @min-[1100px]:flex @min-[1100px]:h-full @min-[1100px]:flex-col ${view === "cover" ? "@min-[1100px]:col-start-1 @min-[1100px]:gap-20 @min-[1100px]:pt-16" : "@min-[1100px]:col-start-4 @min-[1100px]:gap-9 @min-[1100px]:pt-16 @min-[1100px]:pb-20"}`}
            >
                {children}
            </dl>
        </section>
    );
}

export default function BoardPreviewDiagram({
    preview,
    editable = true,
    mainDestination = false
}: {
    preview: Preview;
    editable?: boolean;
    mainDestination?: boolean;
}) {
    const reducedMotion = useReducedMotion();
    const diagramRef = useRef<HTMLDivElement>(null);
    const figures = useRef<Partial<Record<View, HTMLElement>>>({});
    const callouts = useRef<Partial<Record<Field, HTMLDivElement>>>({});
    const [connectors, setConnectors] = useState<Connector[]>([]);
    const [active, setActive] = useState<Field | null>(null);
    const photo = preview.photo;
    const hasDestination = Boolean(photo.destination.trim());
    const hasTags = Boolean(photo.tags?.some((tag) => tag.trim()));
    const hasDuration = Number.isSafeInteger(photo.durationDays) && (photo.durationDays ?? 0) > 0;

    useEffect(() => {
        const diagram = diagramRef.current;
        if (!diagram) return;
        const cover = figures.current.cover?.querySelector<HTMLElement>("article");
        const details = figures.current.details?.querySelector<HTMLElement>("article");
        const targets: Partial<Record<Field, HTMLElement | null>> = {
            title: cover?.querySelector("h3"),
            cover,
            destination: hasDestination ? details?.querySelector('[data-photo-board-field="destination"]') : null,
            tags: hasTags ? details?.querySelector('[data-photo-board-field="tags"]') : null,
            duration: hasDuration ? details?.querySelector('[data-photo-board-field="duration"]') : null
        };
        function measure() {
            if (!diagram) return;
            const bounds = diagram.getBoundingClientRect();
            if (bounds.width < 1100) {
                setConnectors([]);
                return;
            }
            const next = (Object.keys(targets) as Field[]).flatMap((field) => {
                const target = targets[field];
                const callout = callouts.current[field];
                if (!target || !callout) return [];
                const content = target.getBoundingClientRect();
                const label = callout.getBoundingClientRect();
                const leftSide = field === "title" || field === "cover";
                const x =
                    (field === "cover" ? content.left + 12 : leftSide ? content.left - 8 : content.right + 8) -
                    bounds.left;
                const y =
                    content.top -
                    bounds.top +
                    (field === "cover"
                        ? content.height * 0.58
                        : field === "title" || field === "destination"
                          ? parseFloat(getComputedStyle(target).fontSize) * 0.6
                          : content.height / 2);
                const startX = (leftSide ? label.right + 12 : label.left - 12) - bounds.left;
                const startY = label.top - bounds.top + 22;
                const elbow = leftSide
                    ? (cover?.getBoundingClientRect().left ?? content.left) - bounds.left - 20
                    : (details?.getBoundingClientRect().right ?? content.right) - bounds.left + 20;
                return [{ field, path: `M ${startX} ${startY} H ${elbow} V ${y} H ${x}`, x, y }];
            });
            setConnectors((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
        }
        const observer = new ResizeObserver(measure);
        [
            diagram,
            ...Object.values(figures.current),
            ...Object.values(callouts.current),
            ...Object.values(targets)
        ].forEach((element) => {
            if (element) observer.observe(element);
        });
        measure();
        return () => observer.disconnect();
    }, [hasDestination, hasTags, hasDuration]);

    function annotation(field: Field, label: string, children: ReactNode, className?: string) {
        return (
            <Callout
                field={field}
                label={label}
                editable={editable}
                sourceOverride={field === "destination" && mainDestination ? mainDestinationSource : undefined}
                className={className}
                setActive={setActive}
                elementRef={(element) => {
                    if (element) callouts.current[field] = element;
                    else delete callouts.current[field];
                }}
            >
                {children}
            </Callout>
        );
    }

    return (
        <div
            ref={diagramRef}
            className="relative grid min-w-0 gap-x-10 gap-y-16 @min-[760px]:grid-cols-2 @min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,340px)_minmax(0,340px)_minmax(0,1fr)] @min-[1100px]:gap-x-12"
        >
            <svg
                aria-hidden="true"
                className="text-foreground pointer-events-none absolute inset-0 z-10 hidden size-full overflow-visible @min-[1100px]:block"
                fill="none"
            >
                {connectors.map((line) => (
                    <g key={line.field}>
                        <motion.path
                            d={line.path}
                            stroke="currentColor"
                            strokeWidth={0.6}
                            initial={reducedMotion ? false : { pathLength: 0 }}
                            whileInView={{ pathLength: 1 }}
                            viewport={{ once: true }}
                            animate={{ opacity: active === line.field ? 0.65 : 0.22 }}
                            transition={{
                                pathLength: { duration: reducedMotion ? 0 : 0.65 },
                                opacity: { duration: reducedMotion ? 0 : 0.18 }
                            }}
                        />
                        <circle
                            cx={line.x}
                            cy={line.y}
                            r={1.5}
                            fill="currentColor"
                            opacity={active === line.field ? 0.65 : 0.25}
                        />
                    </g>
                ))}
            </svg>
            <PreviewView
                view="cover"
                photo={photo}
                elementRef={(element) => {
                    if (element) figures.current.cover = element;
                }}
            >
                {annotation("title", "Title", "Your Board’s title introduces the journey.")}
                {annotation(
                    "cover",
                    "Cover image",
                    preview.cover
                        ? "The selected cover sets the scene."
                        : photo.image
                          ? "A photo from your Board sets the scene."
                          : "No cover selected. A quiet placeholder holds its place.",
                    "@min-[1100px]:ml-5"
                )}
            </PreviewView>
            <PreviewView
                view="details"
                photo={photo}
                elementRef={(element) => {
                    if (element) figures.current.details = element;
                }}
            >
                {hasDestination
                    ? annotation(
                          "destination",
                          "Destination",
                          mainDestination
                              ? "The main destination selected for this Board."
                              : "From the places in your day plan."
                      )
                    : null}
                {hasTags
                    ? annotation("tags", "Tags", "The themes you’ve chosen for this journey.", "@min-[1100px]:ml-5")
                    : null}
                {hasDuration
                    ? annotation("duration", "Duration", "The number of days in your plan.", "@min-[1100px]:mt-auto")
                    : null}
            </PreviewView>
        </div>
    );
}
