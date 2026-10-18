"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { destinationTransition } from "@/lib/destination-transition";

export default function DestinationTemplate({ children }: { children: ReactNode }) {
    const reduced = useReducedMotion();
    return (
        <motion.div
            className="min-w-0"
            initial={reduced ? false : { opacity: 0, y: -destinationTransition.distance }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: reduced ? 0 : destinationTransition.duration,
                ease: destinationTransition.enterEase
            }}
        >
            {children}
        </motion.div>
    );
}
