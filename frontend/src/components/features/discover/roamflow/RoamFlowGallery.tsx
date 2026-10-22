"use client";

import { memo } from "react";
import { motion, useReducedMotion } from "motion/react";
import DestinationStoryCard from "@/components/features/destinations/DestinationStoryCard";
import type { RoamFlowBoard } from "@/lib/roamflow";

const positions = [
    "md:mt-16 min-[87.5rem]:col-span-3 min-[87.5rem]:mt-32",
    "min-[87.5rem]:col-span-3",
    "md:mt-12 min-[87.5rem]:col-span-3 min-[87.5rem]:mt-20",
    "min-[87.5rem]:col-span-3 min-[87.5rem]:mt-40",
    "md:mt-12 min-[87.5rem]:col-span-4 min-[87.5rem]:mt-4",
    "min-[87.5rem]:col-span-4 min-[87.5rem]:mt-24",
    "md:mt-12 min-[87.5rem]:col-span-4 min-[87.5rem]:mt-10"
];

function RoamFlowGallery({
    boards,
    reduceMotion = false
}: {
    boards: readonly RoamFlowBoard[];
    reduceMotion?: boolean;
}) {
    const systemReducedMotion = useReducedMotion();
    const reducedMotion = reduceMotion || systemReducedMotion;
    return (
        <ol
            aria-label="Travel stories"
            className="grid items-start gap-x-5 gap-y-10 md:grid-cols-2 md:gap-x-7 min-[87.5rem]:grid-cols-12 min-[87.5rem]:gap-x-5 min-[87.5rem]:gap-y-14"
        >
            {boards.map((board, index) => (
                <RoamFlowStory key={board.id} board={board} index={index} reducedMotion={reducedMotion} />
            ))}
        </ol>
    );
}

const RoamFlowStory = memo(function RoamFlowStory({
    board,
    index,
    reducedMotion
}: {
    board: RoamFlowBoard;
    index: number;
    reducedMotion: boolean | null;
}) {
    return (
        <li
            id={`roamflow-story-${board.id}`}
            tabIndex={-1}
            className={`min-w-0 scroll-mt-6 focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-white ${positions[index % positions.length]}`}
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
                    <DestinationStoryCard
                        board={board}
                        href={board.href}
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
                    {String(index + 1).padStart(2, "0")}
                    {board.href ? " ↗" : ""}
                </span>
            </div>
        </li>
    );
});

export default RoamFlowGallery;
