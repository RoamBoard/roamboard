"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
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
    const [position, setPosition] = useState({ overflow: false, progress: 0, visible: 1 });
    useEffect(() => {
        if (!api) return;
        const update = () => {
            const viewport = api.rootNode().clientWidth;
            const length = api.internalEngine().limit.length;
            setPosition({
                overflow: length > 2,
                progress: Math.max(0, Math.min(1, api.scrollProgress())),
                visible: viewport / (viewport + length)
            });
        };
        const wheel = (event: WheelEvent) => {
            if (event.ctrlKey || event.metaKey || (days && !window.matchMedia("(min-width: 768px)").matches)) return;
            const delta =
                Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
            const length = api.internalEngine().limit.length;
            const progress = Math.max(0, Math.min(1, api.scrollProgress()));
            if (!delta || length <= 0 || (delta < 0 ? progress <= 0 : progress >= 1)) return;
            // Run before the outer rail's native listener; React wheel handlers run too late.
            event.preventDefault();
            scrollBoardLibrary(api, progress + delta / length);
        };
        const viewport = api.rootNode();
        viewport.addEventListener("wheel", wheel, { passive: false });
        update();
        api.on("scroll", update).on("reInit", update).on("select", update);
        return () => {
            viewport.removeEventListener("wheel", wheel);
            api.off("scroll", update).off("reInit", update).off("select", update);
        };
    }, [api, days]);
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
                        event.target.closest("[data-activity-row], [draggable=true], input, select, textarea")
                    )
            }}
            className="min-w-0"
        >
            <CarouselContent
                as="ul"
                aria-label={label}
                className={`mt-3 gap-4 pb-3 ${days ? "flex-col md:flex-row md:gap-8" : ""}`}
            >
                {children}
            </CarouselContent>
            {position.overflow ? (
                <div
                    role="group"
                    aria-label={`${label} navigation`}
                    className={`my-4 flex justify-center gap-3 ${days ? "hidden md:flex" : ""}`}
                >
                    <CarouselPrevious aria-label={`Previous ${label.toLowerCase()}`} />
                    <CarouselNext aria-label={`Next ${label.toLowerCase()}`} />
                </div>
            ) : null}
            {position.overflow && !days ? (
                <input
                    type="range"
                    aria-label={`${label} scroll position`}
                    min={0}
                    max={1000}
                    value={Math.round(position.progress * 1000)}
                    onChange={(event) => {
                        if (api) scrollBoardLibrary(api, Number(event.target.value) / 1000);
                    }}
                    style={{ "--thumb-size": `max(24px, ${position.visible * 100}%)` } as CSSProperties}
                    className="board-library-scrollbar my-3 block w-full focus-visible:outline-2"
                />
            ) : null}
        </Carousel>
    );
}
