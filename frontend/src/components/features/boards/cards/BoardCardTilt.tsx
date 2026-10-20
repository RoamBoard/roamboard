"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";

export default function BoardCardTilt({ children, active = true }: { children: ReactNode; active?: boolean }) {
    const reduced = useReducedMotion();
    const bounds = useRef<DOMRect | null>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useSpring(x, { stiffness: 220, damping: 25 });
    const rotateY = useSpring(y, { stiffness: 220, damping: 25 });
    const reset = () => {
        bounds.current = null;
        x.set(0);
        y.set(0);
    };
    useEffect(() => {
        if (!active || reduced) {
            bounds.current = null;
            x.set(0);
            y.set(0);
        }
    }, [active, reduced, x, y]);
    return (
        <motion.div
            className="relative w-full [transform-style:preserve-3d]"
            style={{
                rotateX: !active || reduced ? 0 : rotateX,
                rotateY: !active || reduced ? 0 : rotateY,
                transformPerspective: 1200
            }}
            onPointerEnter={(event) => {
                if (active && !reduced && event.pointerType === "mouse" && !event.buttons)
                    bounds.current = event.currentTarget.getBoundingClientRect();
            }}
            onPointerMove={(event) => {
                if (!active || reduced || event.pointerType !== "mouse" || event.buttons) {
                    reset();
                    return;
                }
                const rect = bounds.current ?? event.currentTarget.getBoundingClientRect();
                bounds.current = rect;
                const horizontal = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
                const vertical = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
                x.set(-(vertical - 0.5) * 3);
                y.set((horizontal - 0.5) * 4);
            }}
            onPointerDown={reset}
            onPointerLeave={reset}
            onPointerCancel={reset}
        >
            {children}
        </motion.div>
    );
}
