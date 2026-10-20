"use client";

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
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
import AccountPhotoBoardCard from "./cards/AccountPhotoBoardCard";
import { BoardDragContext } from "./cards/PhotoBoardCard";
import { scrollBoardLibrary } from "@/lib/board-library-scroll";

type Props = {
    boards: readonly Pick<GalleryBoard, "compact" | "photo" | "ownership" | "href" | "editHref" | "savedByMe">[];
    id?: string;
    title?: string;
    description?: string;
    hasMore?: boolean;
    loadingMore?: boolean;
    onLoadMore?: () => Promise<void>;
    onBoardHighlight?: (boardId: string | null) => void;
    embedded?: boolean;
    showStatus?: boolean;
    onSavedChange?: (boardId: string, saved: boolean) => void;
};

export default function BoardLibrary({
    boards,
    hasMore = false,
    loadingMore = false,
    onLoadMore,
    id = "board-library",
    title = "YOUR COLLECTION",
    description,
    onBoardHighlight,
    embedded = false,
    showStatus = false,
    onSavedChange
}: Props) {
    const interaction = useRef<{ hovered: string | null; focused: string | null }>({ hovered: null, focused: null });
    return (
        <BoardLibraryCarousel
            count={boards.length}
            id={id}
            title={title}
            description={description}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={onLoadMore}
            embedded={embedded}
        >
            {boards.map((board, index) => (
                <CarouselItem
                    key={board.compact.id}
                    aria-label={`${index + 1} of ${boards.length}: ${board.compact.title}`}
                    className={
                        "relative flex basis-[90%] justify-center px-3 sm:basis-[376px] sm:px-6 " +
                        (embedded ? "py-2" : "py-5 sm:py-8")
                    }
                    onMouseEnter={() => {
                        interaction.current.hovered = board.compact.id;
                        onBoardHighlight?.(board.compact.id);
                    }}
                    onMouseLeave={() => {
                        interaction.current.hovered = null;
                        onBoardHighlight?.(interaction.current.focused);
                    }}
                    onFocusCapture={() => {
                        interaction.current.focused = board.compact.id;
                        onBoardHighlight?.(board.compact.id);
                    }}
                    onBlurCapture={(event) => {
                        if (event.currentTarget.contains(event.relatedTarget)) return;
                        interaction.current.focused = null;
                        onBoardHighlight?.(interaction.current.hovered);
                    }}
                >
                    <div className="w-full max-w-[328px] shrink-0 transition-transform duration-200 motion-safe:hover:-translate-y-1 motion-reduce:transition-none">
                        <AccountPhotoBoardCard
                            tilt
                            board={
                                board.photo ?? {
                                    id: board.compact.id,
                                    title: board.compact.title,
                                    author: board.compact.author,
                                    destination: board.compact.destination,
                                    destinationLabel: board.compact.destinationLabel,
                                    image: board.compact.image
                                }
                            }
                            href={board.href}
                            ownership={board.ownership}
                            initialSaved={board.savedByMe}
                            onSavedChange={(saved) => onSavedChange?.(board.compact.id, saved)}
                            showVisibility={showStatus}
                            hideCoverCredit
                            hoverActions={
                                board.href
                                    ? {
                                          editHref: board.ownership === "owner" ? board.editHref : undefined,
                                          viewHref: board.photo?.status === "draft" ? undefined : board.href
                                      }
                                    : undefined
                            }
                            details
                            imageSizes="(max-width: 640px) 75vw, 328px"
                        />
                        {showStatus && board.photo?.status && (
                            <p className="text-muted-foreground mt-3 text-center text-xs">
                                {board.photo.status === "draft" ? "Draft" : "Published"}
                            </p>
                        )}
                    </div>
                </CarouselItem>
            ))}
        </BoardLibraryCarousel>
    );
}

type LibraryVariant = "default" | "profile" | "discover";

// Shared browsing behavior; callers retain their real account-aware cards, links and tag navigation.
export function BoardLibraryCarousel({
    children,
    count,
    id,
    title,
    description,
    hasMore = false,
    loadingMore = false,
    onLoadMore,
    embedded = false,
    variant = "default",
    listLabel,
    emptyMessage
}: Pick<Props, "id" | "title" | "description" | "hasMore" | "loadingMore" | "onLoadMore" | "embedded"> & {
    children: ReactNode;
    count: number;
    id: string;
    title: string;
    variant?: LibraryVariant;
    listLabel?: string;
    emptyMessage?: string;
}) {
    const collectionName = title.toLowerCase().replace(/ boards$/, "");
    const [api, setApi] = useState<CarouselApi>();
    const [position, setPosition] = useState({ progress: 0, visible: 1 });
    const reducedMotion = useReducedMotion();
    const requestedLength = useRef(-1);
    const [dragging, setDragging] = useState(false);
    const pointer = useRef<{ x: number; y: number } | null>(null);
    useEffect(() => {
        const end = () => {
            pointer.current = null;
            setDragging(false);
        };
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        return () => {
            window.removeEventListener("pointerup", end);
            window.removeEventListener("pointercancel", end);
        };
    }, []);

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
                visible.some((index) => index >= count - 2) &&
                requestedLength.current !== count
            ) {
                requestedLength.current = count;
                void onLoadMore?.();
            }
        }
        const frame = requestAnimationFrame(update);
        api.on("scroll", update).on("reInit", update).on("slidesInView", update);
        return () => {
            cancelAnimationFrame(frame);
            api.off("scroll", update).off("reInit", update).off("slidesInView", update);
        };
    }, [api, count, hasMore, loadingMore, onLoadMore]);

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
        <section
            aria-labelledby={`${id}-heading`}
            className={
                variant !== "default"
                    ? "mt-6 min-w-0"
                    : embedded
                      ? "mt-3 min-w-0"
                      : "mx-auto mt-20 max-w-[1320px] md:mt-24"
            }
        >
            <BoardDragContext.Provider value={dragging}>
                <Carousel
                    onPointerDownCapture={(event) => {
                        pointer.current = { x: event.clientX, y: event.clientY };
                    }}
                    onPointerMoveCapture={(event) => {
                        const start = pointer.current;
                        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8)
                            setDragging(true);
                    }}
                    setApi={setApi}
                    opts={{
                        align: "start",
                        containScroll: "trimSnaps",
                        skipSnaps: true,
                        loop: false,
                        duration: reducedMotion ? 0 : 25
                    }}
                    aria-label={`${title} collection`}
                    tabIndex={0}
                    className="outline-offset-[-2px] focus-visible:outline-1"
                >
                    {(count > 0 || variant === "default") && (
                        <div
                            className={
                                variant !== "default"
                                    ? "mb-3 flex items-center justify-between gap-4"
                                    : embedded
                                      ? "mb-2 flex items-center justify-between gap-4"
                                      : "mx-5 mb-6 flex items-center justify-between gap-4 sm:mx-12"
                            }
                        >
                            <h2
                                id={`${id}-heading`}
                                tabIndex={-1}
                                className={
                                    variant === "profile"
                                        ? "sr-only"
                                        : "font-display text-foreground/60 text-24 md:text-36 font-medium"
                                }
                            >
                                {title}
                            </h2>
                        </div>
                    )}
                    {count === 0 && variant !== "default" && (
                        <h2 id={`${id}-heading`} className="sr-only">
                            {title}
                        </h2>
                    )}
                    {description && (
                        <p className="text-12 text-foreground/65 mx-5 mb-8 max-w-xl sm:mx-12">{description}</p>
                    )}
                    {count === 0 && emptyMessage !== "" && (
                        <p role="status" className="text-14 text-foreground/65 mx-5 py-16 text-center">
                            {emptyMessage ?? `No ${collectionName} Boards match your search.`}
                        </p>
                    )}
                    {(count > 0 || listLabel) && (
                        <div
                            className={
                                variant !== "default"
                                    ? "border-line/50 border-t"
                                    : embedded
                                      ? "border-line/50 border-x"
                                      : "border-line/50 mx-3 border-x sm:mx-10"
                            }
                        >
                            <CarouselContent
                                as={listLabel ? "ul" : "div"}
                                aria-label={listLabel}
                                tabIndex={listLabel ? -1 : undefined}
                                className={
                                    variant !== "default"
                                        ? "cursor-grab items-start py-5 select-none active:cursor-grabbing"
                                        : embedded
                                          ? "cursor-grab py-2 select-none active:cursor-grabbing"
                                          : "cursor-grab py-5 select-none active:cursor-grabbing md:py-8"
                                }
                            >
                                {children}
                            </CarouselContent>
                            {count > 0 && (
                                <div
                                    role="group"
                                    aria-label={`${title} navigation`}
                                    className="mx-auto grid w-fit grid-cols-2 place-items-center gap-3 pt-4"
                                >
                                    <CarouselPrevious
                                        aria-label={`Previous ${collectionName} Boards`}
                                        className="text-foreground static rounded-none border-0 disabled:opacity-100! [&>svg]:size-7"
                                    />
                                    <CarouselNext
                                        aria-label={`Next ${collectionName} Boards`}
                                        className="text-foreground static rounded-none border-0 disabled:opacity-100! [&>svg]:size-7"
                                    />
                                </div>
                            )}
                            {count > 0 && (
                                <input
                                    type="range"
                                    aria-label={`${title} scroll position`}
                                    min={0}
                                    max={1000}
                                    value={Math.round(position.progress * 1000)}
                                    disabled={!api || position.visible >= 1}
                                    onChange={(event) => {
                                        if (api) scrollBoardLibrary(api, Number(event.target.value) / 1000);
                                    }}
                                    style={{ "--thumb-size": `max(24px, ${position.visible * 100}%)` } as CSSProperties}
                                    className={`board-library-scrollbar focus-visible:outline-foreground block focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-default ${variant !== "default" ? "mt-3 mb-5 w-full" : "mx-auto mt-8 mb-10 w-2/3 max-w-[800px]"}`}
                                />
                            )}
                        </div>
                    )}
                    {(count > 0 || variant === "default") && (
                        <p className="text-10 text-foreground/65 mt-4 px-5 text-center" role="status">
                            {loadingMore
                                ? "Loading more Boards…"
                                : `${count} ${count === 1 ? "Board" : "Boards"} · drag, swipe or scroll to explore`}
                        </p>
                    )}
                </Carousel>
            </BoardDragContext.Provider>
        </section>
    );
}

export function boardLibrarySlideClass(variant: "profile" | "discover") {
    return variant === "profile"
        ? "relative min-w-0 shrink-0 grow-0 basis-[86%] pr-5 sm:basis-[280px] sm:pr-8"
        : "relative min-w-0 shrink-0 grow-0 basis-[90%] pr-6 sm:basis-[360px] sm:pr-10";
}

export function BoardLibrarySlide({
    children,
    title,
    index,
    count,
    variant = "profile"
}: {
    children: ReactNode;
    title: string;
    index: number;
    count: number;
    variant?: "profile" | "discover";
}) {
    return (
        <CarouselItem aria-label={`${index + 1} of ${count}: ${title}`} className={boardLibrarySlideClass(variant)}>
            {children}
        </CarouselItem>
    );
}
