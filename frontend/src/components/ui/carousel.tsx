"use client";

// Adapted from shadcn/ui's Carousel (MIT, SHADCN-LICENSE.txt).
// Native buttons and Roamboard tokens replace the registry's Button dependency.
import {
    createContext,
    useContext,
    useCallback,
    useEffect,
    useState,
    type ComponentProps,
    type HTMLAttributes
} from "react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useReducedMotion } from "motion/react";

export type CarouselApi = NonNullable<UseEmblaCarouselType[1]>;
type CarouselOptions = Parameters<typeof useEmblaCarousel>[0];
type Context = {
    carouselRef: UseEmblaCarouselType[0];
    scrollPrev: () => void;
    scrollNext: () => void;
    canScrollPrev: boolean;
    canScrollNext: boolean;
};
const CarouselContext = createContext<Context | null>(null);
function useCarousel() {
    const context = useContext(CarouselContext);
    if (!context) throw new Error("Carousel controls require a Carousel.");
    return context;
}

export function Carousel({
    opts,
    setApi,
    children,
    className = "",
    ...props
}: ComponentProps<"div"> & {
    opts?: CarouselOptions;
    setApi?: (api: CarouselApi) => void;
}) {
    const [carouselRef, api] = useEmblaCarousel(opts);
    const reducedMotion = useReducedMotion();
    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(false);
    const onSelect = useCallback((current: CarouselApi) => {
        setCanScrollPrev(current.canScrollPrev());
        setCanScrollNext(current.canScrollNext());
    }, []);
    const scrollPrev = useCallback(() => api?.scrollPrev(Boolean(reducedMotion)), [api, reducedMotion]);
    const scrollNext = useCallback(() => api?.scrollNext(Boolean(reducedMotion)), [api, reducedMotion]);
    useEffect(() => {
        if (!api) return;
        const frame = requestAnimationFrame(() => {
            setApi?.(api);
            onSelect(api);
        });
        api.on("select", onSelect).on("reInit", onSelect);
        return () => {
            cancelAnimationFrame(frame);
            api.off("select", onSelect).off("reInit", onSelect);
        };
    }, [api, onSelect, setApi]);
    return (
        <CarouselContext.Provider
            value={{
                carouselRef,
                scrollPrev,
                scrollNext,
                canScrollPrev,
                canScrollNext
            }}
        >
            <div
                role="region"
                aria-roledescription="carousel"
                className={`relative ${className}`}
                onKeyDownCapture={(event) => {
                    if (
                        event.target instanceof Element &&
                        event.target.closest(
                            "input, textarea, select, button[aria-expanded]:not([data-board-disclosure]), button[aria-pressed]"
                        )
                    )
                        return;
                    if (event.key === "ArrowLeft") {
                        event.preventDefault();
                        scrollPrev();
                    }
                    if (event.key === "ArrowRight") {
                        event.preventDefault();
                        scrollNext();
                    }
                }}
                {...props}
            >
                {children}
            </div>
        </CarouselContext.Provider>
    );
}

export function CarouselContent({
    className = "",
    as: Tag = "div",
    ...props
}: HTMLAttributes<HTMLElement> & { as?: "div" | "ul" }) {
    const { carouselRef } = useCarousel();
    return (
        <div ref={carouselRef} className="overflow-hidden">
            <Tag className={`flex touch-pan-y ${className}`} {...props} />
        </div>
    );
}

export function CarouselItem({ className = "", ...props }: ComponentProps<"div">) {
    return (
        <div
            role="group"
            aria-roledescription="slide"
            className={`min-w-0 shrink-0 grow-0 basis-full ${className}`}
            {...props}
        />
    );
}

const controlClass =
    "border-line bg-background text-foreground inline-flex size-11 cursor-pointer items-center justify-center rounded-full border transition-[transform,background-color] hover:scale-110 hover:bg-faint focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-default disabled:opacity-30 motion-reduce:transition-none motion-reduce:transform-none";
export function ScrollArrow({
    direction,
    className = "",
    ...props
}: ComponentProps<"button"> & { direction: "previous" | "next" }) {
    return (
        <button
            type="button"
            className={`${controlClass} ${className}`}
            aria-label={direction === "previous" ? "Previous slide" : "Next slide"}
            {...props}
        >
            {direction === "previous" ? (
                <ArrowLeft size={18} aria-hidden="true" />
            ) : (
                <ArrowRight size={18} aria-hidden="true" />
            )}
        </button>
    );
}
export function CarouselPrevious({ className = "", ...props }: ComponentProps<"button">) {
    const { scrollPrev, canScrollPrev } = useCarousel();
    return ScrollArrow({ direction: "previous", className, onClick: scrollPrev, disabled: !canScrollPrev, ...props });
}
export function CarouselNext({ className = "", ...props }: ComponentProps<"button">) {
    const { scrollNext, canScrollNext } = useCarousel();
    return ScrollArrow({ direction: "next", className, onClick: scrollNext, disabled: !canScrollNext, ...props });
}
