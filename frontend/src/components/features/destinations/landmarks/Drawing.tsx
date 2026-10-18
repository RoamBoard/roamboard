"use client";

import { motion } from "motion/react";
import type { RoamLandmarkId } from "@/lib/roam-landmarks";

export type Stroke = { d: string; phase?: number; duration?: number; reverse?: boolean; weight?: number };
export type Study = { viewBox?: string; strokes: readonly Stroke[] };
export type DrawingProps = { landmark: RoamLandmarkId; drawSeconds: number };

export function Drawing({ study, drawSeconds }: { study: Study; drawSeconds: number }) {
    return (
        <svg viewBox={study.viewBox ?? "0 0 300 260"} fill="none" className="roam-world-drawing" aria-hidden="true">
            {study.strokes.map((stroke, index) => (
                <motion.path
                    key={index}
                    d={stroke.d}
                    stroke="currentColor"
                    strokeWidth={stroke.weight ?? 0.7}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, pathOffset: stroke.reverse ? 1 : 0, opacity: 0 }}
                    animate={{ pathLength: 1, pathOffset: 0, opacity: 1 }}
                    transition={{
                        pathLength: {
                            duration: drawSeconds * (stroke.duration ?? 0.7),
                            delay: (stroke.phase ?? 0) * 0.38,
                            ease: "easeInOut"
                        },
                        pathOffset: {
                            duration: drawSeconds * (stroke.duration ?? 0.7),
                            delay: (stroke.phase ?? 0) * 0.38,
                            ease: "easeInOut"
                        },
                        opacity: { duration: 0.5, delay: (stroke.phase ?? 0) * 0.38 }
                    }}
                />
            ))}
        </svg>
    );
}
