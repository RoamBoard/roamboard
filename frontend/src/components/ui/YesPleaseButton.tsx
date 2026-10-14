"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// How often the button flashes to invite a click, and for how long.
const FLASH_EVERY_MS = 4000;
const FLASH_FOR_MS = 1200;

type Props = {
    href: string;
};

export default function YesPleaseButton({ href }: Props) {
    const [flashing, setFlashing] = useState(false);
    // A ref instead of `let`: the project only allows const.
    const offTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Design 2.3: the background switches to black at intervals.
    useEffect(() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion) return;

        const interval = setInterval(() => {
            setFlashing(true);
            offTimer.current = setTimeout(() => setFlashing(false), FLASH_FOR_MS);
        }, FLASH_EVERY_MS);

        return () => {
            clearInterval(interval);
            clearTimeout(offTimer.current);
        };
    }, []);

    return (
        <Link
            href={href}
            className={[
                "group inline-flex items-center px-5 py-4",
                "font-body text-16 sm:text-20 leading-none",
                "transition-colors duration-500 motion-reduce:transition-none",
                // Design 2.4: hover / keyboard focus = black background + arrow
                "hover:bg-foreground hover:text-background",
                "focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none",
                flashing ? "bg-foreground text-background" : "text-foreground bg-transparent"
            ].join(" ")}
        >
            yes please.
            {/* Arrow slides in by growing the wrapper's width from 0 */}
            <span
                aria-hidden="true"
                className="w-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:w-9 group-hover:opacity-100 group-focus-visible:w-9 group-focus-visible:opacity-100 motion-reduce:transition-none"
            >
                <svg
                    width="24"
                    height="16"
                    viewBox="0 0 24 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    className="ml-3 block max-w-none"
                >
                    <path d="M0 8h22M15 1l7 7-7 7" />
                </svg>
            </span>
        </Link>
    );
}
