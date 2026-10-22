"use client";

import type { MouseEventHandler } from "react";

type Props = {
    targetId: string;
    label?: string;
    className?: string;
    direction?: "down" | "right" | "left";
    lines?: boolean;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export default function ScrollCue({
    targetId,
    label = "Scroll down",
    className = "",
    direction = "down",
    lines = true,
    onClick
}: Props) {
    return (
        <a
            href={`#${targetId}`}
            aria-label={label}
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key === " " && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.click();
                }
            }}
            className={`group text-graphite flex items-center focus-visible:outline-none ${direction === "down" ? "flex-col" : "flex-row"} ${className}`}
        >
            {lines ? (
                <span
                    aria-hidden="true"
                    className={direction === "down" ? "bg-line h-16 w-px sm:h-20" : "bg-line h-px w-4"}
                />
            ) : null}
            <span
                className={`border-line bg-background group-hover:border-foreground group-hover:text-foreground group-focus-visible:outline-foreground grid place-items-center rounded-full border transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-4 motion-reduce:transition-none ${direction === "down" ? "size-7" : "size-12"}`}
            >
                <svg
                    aria-hidden="true"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.8"
                    className={direction === "right" ? "-rotate-90" : direction === "left" ? "rotate-90" : undefined}
                >
                    <path d="M6 1v9M2.5 6.5 6 10l3.5-3.5" />
                </svg>
            </span>
            {lines ? (
                <span
                    aria-hidden="true"
                    className={direction === "down" ? "bg-line h-16 w-px sm:h-24" : "bg-line h-px w-4"}
                />
            ) : null}
            <span className="sr-only">{label}</span>
        </a>
    );
}
