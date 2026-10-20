"use client";

import { motion, useReducedMotion } from "motion/react";
import AccountPhotoBoardCard from "@/components/features/boards/cards/AccountPhotoBoardCard";
import { roamFlowPageSize, type RoamFlowBoard } from "@/lib/roamflow";

const positions = [
    "md:mt-16 min-[87.5rem]:col-span-3 min-[87.5rem]:mt-32",
    "min-[87.5rem]:col-span-3",
    "md:mt-12 min-[87.5rem]:col-span-3 min-[87.5rem]:mt-20",
    "min-[87.5rem]:col-span-3 min-[87.5rem]:mt-40",
    "md:mt-12 min-[87.5rem]:col-span-4 min-[87.5rem]:mt-4",
    "min-[87.5rem]:col-span-4 min-[87.5rem]:mt-24",
    "md:mt-12 min-[87.5rem]:col-span-4 min-[87.5rem]:mt-10"
];

export default function RoamFlowGallery({
    boards,
    reduceMotion = false
}: {
    boards: readonly RoamFlowBoard[];
    reduceMotion?: boolean;
}) {
    const systemReducedMotion = useReducedMotion();
    const reducedMotion = reduceMotion || systemReducedMotion;
    const spreads = Array.from({ length: Math.ceil(boards.length / roamFlowPageSize) }, (_, index) =>
        boards.slice(index * roamFlowPageSize, (index + 1) * roamFlowPageSize)
    );
    return (
        <div className="space-y-16 md:space-y-24">
            {spreads.map((spread, spreadIndex) => (
                <div key={spread[0].id}>
                    {spreadIndex > 0 && (
                        <div className="mb-10 flex items-center gap-5 border-t border-white/15 pt-5 md:mb-16">
                            <span className="text-12 text-white/50 tabular-nums">
                                {String(spreadIndex + 1).padStart(2, "0")}
                            </span>
                            <p className="font-display text-24 leading-tight text-white/80">
                                {spreadIndex % 2 === 1 ? "Take the longer way." : "Somewhere you haven’t been. Yet."}
                            </p>
                        </div>
                    )}
                    <ol
                        start={spreadIndex * roamFlowPageSize + 1}
                        aria-label={`Travel stories, collection ${spreadIndex + 1}`}
                        className="grid items-start gap-x-5 gap-y-10 md:grid-cols-2 md:gap-x-7 min-[87.5rem]:grid-cols-12 min-[87.5rem]:gap-x-5 min-[87.5rem]:gap-y-14"
                    >
                        {spread.map((board, index) => (
                            <li
                                key={board.id}
                                id={`roamflow-story-${board.id}`}
                                tabIndex={-1}
                                className={`min-w-0 scroll-mt-6 focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-white ${positions[index]}`}
                            >
                                {/* Explicit geometry keeps offscreen cards and lazy images from moving the layout. */}
                                <div className="aspect-[4/5] [content-visibility:auto]">
                                    <motion.div
                                        initial={false}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true, amount: 0.08 }}
                                        style={reducedMotion ? undefined : { opacity: 0.65, y: 12 }}
                                        transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                                        className={`relative motion-reduce:transform-none! motion-reduce:opacity-100! [&_a]:focus-visible:outline-offset-4 [&_a]:focus-visible:outline-white ${reducedMotion ? "" : "[&_img]:transition-transform [&_img]:duration-700 [&_img]:ease-out motion-safe:hover:[&_img]:scale-[1.025] motion-reduce:[&_img]:transition-none"}`}
                                    >
                                        <AccountPhotoBoardCard
                                            board={board}
                                            href={board.href}
                                            ownership="other"
                                            initialSaved={false}
                                            showVisibility
                                            hideCoverCredit
                                            hoverActions={board.href ? { viewHref: board.href } : undefined}
                                            details
                                        />
                                    </motion.div>
                                </div>
                                <div className="text-12 mt-3 flex items-baseline justify-between gap-3 leading-relaxed text-white/55">
                                    <span>{board.destination}</span>
                                    <span aria-hidden="true" className="shrink-0 text-white/35 tabular-nums">
                                        {String(spreadIndex * roamFlowPageSize + index + 1).padStart(2, "0")}
                                        {board.href ? " ↗" : ""}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            ))}
        </div>
    );
}
