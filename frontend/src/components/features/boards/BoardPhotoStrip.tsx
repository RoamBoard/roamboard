"use client";
import { useState, type ReactNode } from "react";
import { Carousel, CarouselContent, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { scrollBoardLibrary } from "@/lib/board-library-scroll";
export default function BoardPhotoStrip({
    label,
    children,
    days = false
}: {
    label: string;
    children: ReactNode;
    days?: boolean;
}) {
    const [api, setApi] = useState<CarouselApi>();
    return (
        <Carousel
            aria-label={label}
            setApi={setApi}
            opts={{
                align: "start",
                dragFree: true,
                containScroll: "trimSnaps",
                breakpoints: days ? { "(max-width: 767px)": { active: false } } : undefined,
                watchDrag: (_api, event) =>
                    !(
                        event.target instanceof Element &&
                        event.target.closest("[draggable=true], input, select, textarea")
                    )
            }}
            className="min-w-0"
            onWheel={(event) => {
                if (
                    !api ||
                    event.ctrlKey ||
                    event.metaKey ||
                    (days && !window.matchMedia("(min-width: 768px)").matches)
                )
                    return;
                const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0);
                if (!delta) return;
                const length = api.internalEngine().limit.length;
                if (length > 0) scrollBoardLibrary(api, api.scrollProgress() + delta / length);
            }}
        >
            <CarouselContent
                as="ul"
                aria-label={label}
                className={`mt-3 gap-4 pb-3 ${days ? "flex-col md:flex-row md:gap-8" : ""}`}
            >
                {children}
            </CarouselContent>
            <div
                role="group"
                aria-label={`${label} navigation`}
                className={`my-4 flex justify-center gap-3 ${days ? "hidden md:flex" : ""}`}
            >
                <CarouselPrevious aria-label={`Previous ${label.toLowerCase()}`} />
                <CarouselNext aria-label={`Next ${label.toLowerCase()}`} />
            </div>
        </Carousel>
    );
}
