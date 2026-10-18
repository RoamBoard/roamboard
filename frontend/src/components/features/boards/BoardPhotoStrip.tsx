"use client";

import { useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function BoardPhotoStrip({ label, children }: { label: string; children: ReactNode }) {
    const strip = useRef<HTMLUListElement>(null);
    function scroll(direction: number) {
        const element = strip.current;
        if (!element) return;
        element.scrollBy({
            left: direction * Math.max(120, element.clientWidth * 0.8),
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
        });
    }
    return (
        <div className="min-w-0">
            <ul ref={strip} aria-label={label} className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
                {children}
            </ul>
            <div role="group" aria-label={`${label} navigation`} className="mt-2 flex justify-end gap-2">
                <button
                    type="button"
                    aria-label={`Previous ${label.toLowerCase()}`}
                    onClick={() => scroll(-1)}
                    className="border-line hover:bg-faint grid size-10 place-items-center rounded-full border"
                >
                    <ArrowLeft aria-hidden="true" size={16} />
                </button>
                <button
                    type="button"
                    aria-label={`Next ${label.toLowerCase()}`}
                    onClick={() => scroll(1)}
                    className="border-line hover:bg-faint grid size-10 place-items-center rounded-full border"
                >
                    <ArrowRight aria-hidden="true" size={16} />
                </button>
            </div>
        </div>
    );
}
