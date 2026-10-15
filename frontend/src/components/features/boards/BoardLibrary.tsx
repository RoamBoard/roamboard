"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
    type CarouselApi
} from "@/components/ui/carousel";
import type { GalleryBoard } from "@/lib/my-boards";
import BoardCard from "./cards/BoardCard";

type Props = {
    boards: readonly GalleryBoard[];
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => Promise<void>;
};

export default function BoardLibrary({ boards, hasMore, loadingMore, onLoadMore }: Props) {
    const [api, setApi] = useState<CarouselApi>();
    const [position, setPosition] = useState({ progress: 0, visible: 1 });
    const reducedMotion = useReducedMotion();
    const requestedLength = useRef(-1);

    useEffect(() => {
        if (!api) return;
        function update() {
            if (!api) return;
            const visible = api.slidesInView();
            const canScroll = api.canScrollPrev() || api.canScrollNext();
            setPosition({
                progress: Math.max(0, Math.min(1, api.scrollProgress())),
                visible: canScroll ? Math.min(1, api.rootNode().clientWidth / api.containerNode().scrollWidth) : 1
            });
            // Request once per collection size, retaining the manual retry if a request fails.
            if (
                hasMore &&
                !loadingMore &&
                visible.some((index) => index >= boards.length - 2) &&
                requestedLength.current !== boards.length
            ) {
                requestedLength.current = boards.length;
                void onLoadMore();
            }
        }
        const frame = requestAnimationFrame(update);
        api.on("scroll", update).on("reInit", update).on("slidesInView", update);
        return () => {
            cancelAnimationFrame(frame);
            api.off("scroll", update).off("reInit", update).off("slidesInView", update);
        };
    }, [api, boards.length, hasMore, loadingMore, onLoadMore]);

    useEffect(() => {
        if (!api) return;
        const wheel = { distance: 0 };
        function onWheel(event: WheelEvent) {
            const delta =
                Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
            if (!delta || !api) return;
            const direction = delta > 0 ? 1 : -1;
            if ((direction > 0 && !api.canScrollNext()) || (direction < 0 && !api.canScrollPrev())) return;
            event.preventDefault();
            wheel.distance = Math.sign(wheel.distance) === direction ? wheel.distance + delta : delta;
            if (Math.abs(wheel.distance) < 50) return;
            wheel.distance = 0;
            if (direction > 0) api.scrollNext(Boolean(reducedMotion));
            else api.scrollPrev(Boolean(reducedMotion));
        }
        const root = api.rootNode();
        root.addEventListener("wheel", onWheel, { passive: false });
        return () => root.removeEventListener("wheel", onWheel);
    }, [api, reducedMotion]);

    return (
        <section aria-labelledby="board-library-heading" className="mx-auto mt-20 max-w-[1320px] md:mt-24">
            <Carousel
                setApi={setApi}
                opts={{
                    align: "start",
                    containScroll: "trimSnaps",
                    skipSnaps: true,
                    loop: false,
                    duration: reducedMotion ? 0 : 25
                }}
                aria-label="Your Board collection"
                tabIndex={0}
                className="outline-offset-[-2px] focus-visible:outline-1"
            >
                <div className="mx-5 mb-6 flex items-center justify-between gap-4 sm:mx-12">
                    <h2
                        id="board-library-heading"
                        className="font-display text-card-subtle text-24 md:text-36 font-medium"
                    >
                        YOUR COLLECTION
                    </h2>
                    <div className="flex gap-2">
                        <CarouselPrevious aria-label="Previous collection Boards" className="rounded-none border-0" />
                        <CarouselNext aria-label="Next collection Boards" className="rounded-none border-0" />
                    </div>
                </div>
                <div className="border-line/50 mx-3 border-x sm:mx-10">
                    <CarouselContent className="cursor-grab py-5 select-none active:cursor-grabbing md:py-8">
                        {boards.map((board, index) => (
                            <CarouselItem
                                key={board.collage.id}
                                aria-label={`${index + 1} of ${boards.length}: ${board.compact.title}`}
                                className="border-line/60 relative flex basis-[220px] justify-center border-r px-5 py-12 last:border-r sm:basis-[320px] sm:px-[70px]"
                            >
                                <div className="w-[180px] shrink-0">
                                    <BoardCard variant="compact" board={board.compact} href={board.href} />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <div
                        role="progressbar"
                        aria-label="Board collection scroll position"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(position.progress * 100)}
                        className="bg-line/60 relative mx-auto mt-8 mb-10 h-px w-2/3 max-w-[800px]"
                    >
                        <div
                            className="bg-muted-foreground absolute -top-px h-[3px]"
                            style={{
                                width: `${position.visible * 100}%`,
                                left: `${position.progress * (1 - position.visible) * 100}%`
                            }}
                        />
                    </div>
                </div>
                <p className="text-10 text-muted-foreground mt-4 px-5 text-center" role="status">
                    {loadingMore
                        ? "Loading more Boards…"
                        : `${boards.length} Boards · drag, swipe or scroll to explore`}
                </p>
            </Carousel>
        </section>
    );
}
