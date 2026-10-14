"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
    type CarouselApi
} from "@/components/ui/carousel";

export default function DiscoverIntroCarousel({
    hero,
    journey,
    onTravel
}: {
    hero: ReactNode;
    journey: readonly ReactNode[];
    onTravel: (travelled: boolean) => void;
}) {
    const [api, setApi] = useState<CarouselApi>();
    const [position, setPosition] = useState({ current: 1, total: 1 });
    const update = useCallback(
        (current: CarouselApi) => {
            setPosition({
                current: current.selectedScrollSnap() + 1,
                total: current.scrollSnapList().length
            });
            onTravel(current.selectedScrollSnap() > 0);
        },
        [onTravel]
    );
    useEffect(() => {
        if (!api) return;
        const frame = requestAnimationFrame(() => update(api));
        api.on("select", update).on("reInit", update);
        return () => {
            cancelAnimationFrame(frame);
            api.off("select", update).off("reInit", update);
        };
    }, [api, update]);
    return (
        <Carousel
            setApi={setApi}
            opts={{ align: "start", containScroll: "trimSnaps" }}
            aria-label="Discover introduction and photo sequence"
            tabIndex={0}
            className="w-full focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
            <CarouselContent>
                <CarouselItem aria-label="Destination of the month" className="flex">
                    {hero}
                </CarouselItem>
                {journey.map((panel, index) => (
                    <CarouselItem
                        key={index}
                        className="flex"
                        aria-label={`Travel inspiration ${index + 1} of ${journey.length}`}
                    >
                        {panel}
                    </CarouselItem>
                ))}
            </CarouselContent>
            <div className="border-line flex items-center justify-between gap-3 border-b px-5 py-4 md:px-10">
                <p className="text-muted-foreground text-12">
                    Swipe to explore · {position.current} / {position.total}
                </p>
                <div className="flex gap-2">
                    <CarouselPrevious />
                    <CarouselNext />
                </div>
            </div>
        </Carousel>
    );
}
