"use client";

import { LibraryImg } from "@/components/images/LibraryImage";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import PinCategoryIcon from "@/components/ui/PinCategoryIcon";
import { fromBoardDocument, loadBoardDocument, type BoardDocument } from "@/lib/board-creator-api";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { dayColors } from "@/types/board-creator";

export type ActiveImageDetail = {
    id?: string;
    url: string;
    title: string;
    subtitle?: string;
    alt: string;
    credit?: string | null;
    creditUrl?: string | null;
    sourceUrl?: string | null;
    capturedAt?: string | null;
};

export type ImageDetailDialogProps = {
    images?: ActiveImageDetail[];
    image?: ActiveImageDetail;
    initialIndex?: number;
    onClose: () => void;
};

export function ImageDetailDialog({ images: imagesProp, image, initialIndex = 0, onClose }: ImageDetailDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(dialogRef, onClose);

    const images = imagesProp ?? (image ? [image] : []);
    const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, Math.max(0, images.length - 1))));

    const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
    const next = () => setIndex((i) => (i + 1) % images.length);

    useEffect(() => {
        if (images.length <= 1) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                setIndex((i) => (i - 1 + images.length) % images.length);
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                setIndex((i) => (i + 1) % images.length);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [images.length]);

    const current = images[index];
    if (!current) return null;

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 sm:p-8"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="image-detail-title"
                tabIndex={-1}
                className="bg-background max-h-[92dvh] w-full max-w-4xl overflow-y-auto p-6 shadow-2xl outline-none sm:p-8"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            {current.subtitle ? (
                                <p className="text-10 tracking-label text-muted-foreground font-bold uppercase">
                                    {current.subtitle}
                                </p>
                            ) : null}
                            {images.length > 1 ? (
                                <span className="border-line text-11 text-muted-foreground border px-2 py-0.5 font-mono">
                                    {index + 1} / {images.length}
                                </span>
                            ) : null}
                        </div>
                        <h2 id="image-detail-title" className="font-display text-24 sm:text-28 mt-1 truncate font-bold">
                            {current.title}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="border-line text-22 hover:bg-faint grid size-10 shrink-0 place-items-center border"
                        aria-label="Close photo details"
                    >
                        ×
                    </button>
                </div>

                <div className="border-line bg-faint relative mt-6 flex h-[62vh] min-h-[300px] w-full items-center justify-center overflow-hidden border">
                    <div
                        className="flex h-full w-full transition-transform duration-300 ease-out motion-reduce:transition-none"
                        style={{ transform: `translateX(-${index * 100}%)` }}
                    >
                        {images.map((img, i) => (
                            <div
                                key={img.url + i}
                                className="flex h-full min-w-full items-center justify-center p-4 sm:p-6"
                            >
                                <LibraryImg
                                    src={img.url}
                                    alt={img.alt}
                                    className="max-h-full max-w-full object-contain select-none"
                                />
                            </div>
                        ))}
                    </div>

                    {images.length > 1 ? (
                        <>
                            <button
                                type="button"
                                onClick={prev}
                                className="border-line bg-background/80 hover:bg-background text-foreground focus:ring-foreground absolute top-1/2 left-3 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border shadow-md backdrop-blur-sm transition-transform hover:scale-105 focus:ring-2 focus:outline-none active:scale-95"
                                aria-label="Previous photo"
                            >
                                <ChevronLeft className="size-5" />
                            </button>
                            <button
                                type="button"
                                onClick={next}
                                className="border-line bg-background/80 hover:bg-background text-foreground focus:ring-foreground absolute top-1/2 right-3 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border shadow-md backdrop-blur-sm transition-transform hover:scale-105 focus:ring-2 focus:outline-none active:scale-95"
                                aria-label="Next photo"
                            >
                                <ChevronRight className="size-5" />
                            </button>
                        </>
                    ) : null}
                </div>

                {current.credit || current.capturedAt ? (
                    <div className="text-12 text-muted-foreground mt-4 flex flex-wrap items-center justify-between gap-2">
                        {current.credit ? (
                            <p>
                                Photo by{" "}
                                {current.creditUrl ? (
                                    <a
                                        href={current.creditUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="hover:text-foreground underline"
                                    >
                                        {current.credit}
                                    </a>
                                ) : (
                                    current.credit
                                )}
                                {current.sourceUrl ? (
                                    <>
                                        {" "}
                                        on{" "}
                                        <a
                                            href={current.sourceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="hover:text-foreground underline"
                                        >
                                            Unsplash
                                        </a>
                                    </>
                                ) : null}
                            </p>
                        ) : (
                            <span />
                        )}
                        {current.capturedAt ? (
                            <time dateTime={current.capturedAt}>Captured {current.capturedAt.slice(0, 10)}</time>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function PublishedBoardView({
    boardId,
    initialBoard
}: {
    boardId: string;
    initialBoard?: BoardDocument;
}) {
    const [board, setBoard] = useState<BoardDocument | null>(initialBoard ?? null);
    const [error, setError] = useState("");
    const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

    useEffect(() => {
        if (initialBoard) return;
        void loadBoardDocument(Number(boardId))
            .then(setBoard)
            .catch((caught: unknown) =>
                setError(caught instanceof Error ? caught.message : "The Board could not be loaded.")
            );
    }, [boardId, initialBoard]);

    if (error)
        return (
            <div className="px-6 py-20 sm:px-12">
                <p className="text-10 tracking-label text-muted-foreground uppercase">Board inspector</p>
                <h1 className="font-display text-48 mt-4 font-bold">Could not load Board</h1>
                <p className="text-14 text-muted-foreground mt-4" role="alert">
                    {error}
                </p>
            </div>
        );
    if (!board)
        return (
            <div className="text-13 text-muted-foreground grid min-h-[70dvh] place-items-center" role="status">
                Loading Board…
            </div>
        );

    const restored = fromBoardDocument(board);
    const uploadedImages = restored.images.filter((image) => image.source === "upload");
    const cover = uploadedImages.find((image) => image.uploadedImageId === board.coverImageId);
    const totalPins = restored.days.reduce((sum, day) => sum + day.pins.length, 0);

    const galleryImages: ActiveImageDetail[] = [
        ...(cover
            ? [
                  {
                      id: cover.id,
                      url: cover.url,
                      title: board.title || "Untitled Board",
                      subtitle: "Board cover",
                      alt: `Cover of ${board.title || "Untitled Board"}`,
                      credit: cover.credit,
                      creditUrl: cover.creditUrl,
                      sourceUrl: cover.sourceUrl,
                      capturedAt: cover.capturedAt
                  }
              ]
            : []),
        ...restored.days.flatMap((day) =>
            day.pins.flatMap((pin) => {
                const pinImgs = restored.images
                    .filter((img) => img.pinId === pin.id)
                    .sort((a, b) => (a.activityOrder ?? a.order) - (b.activityOrder ?? b.order));
                return pinImgs.map((img, i) => ({
                    id: img.id,
                    url: img.url,
                    title: pin.title,
                    subtitle:
                        pinImgs.length > 1
                            ? `Day ${day.dayNumber} · Photo ${i + 1} of ${pinImgs.length}`
                            : `Day ${day.dayNumber} · Activity photo`,
                    alt: `${pin.title} photo`,
                    credit: img.credit,
                    creditUrl: img.creditUrl,
                    sourceUrl: img.sourceUrl,
                    capturedAt: img.capturedAt
                }));
            })
        )
    ];

    return (
        <article className="px-5 py-16 sm:px-10 lg:px-16">
            <header className="border-line mx-auto max-w-7xl border-b pb-12">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="text-10 tracking-label text-muted-foreground font-bold uppercase">
                        Saved Itinerary · {board.status}
                    </p>
                    <span className="border-line text-10 tracking-label border px-3 py-1 uppercase">
                        {board.visibility}
                    </span>
                </div>
                <h1 className="font-display text-48 sm:text-72 mt-4 leading-none font-bold">
                    {board.title || "Untitled Board"}
                </h1>
                {board.description ? (
                    <p className="text-16 text-muted-foreground mt-5 max-w-3xl leading-relaxed whitespace-pre-line">
                        {board.description}
                    </p>
                ) : null}
                <div className="text-12 text-muted-foreground mt-6 flex flex-wrap items-center gap-6">
                    <span>
                        {restored.days.length} day
                        {restored.days.length === 1 ? "" : "s"}
                    </span>
                    <span>
                        {totalPins} pin{totalPins === 1 ? "" : "s"}
                    </span>
                    <span>
                        {restored.images.length} photo
                        {restored.images.length === 1 ? "" : "s"}
                    </span>
                    <span className="text-muted-foreground">Board ID: {board.boardId}</span>
                </div>
                {board.tags.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2" aria-label="Board tags">
                        {board.tags.map((tag) => (
                            <span
                                key={tag.tagId}
                                className="border-line bg-faint text-11 text-muted-foreground border px-3 py-1"
                            >
                                #{tag.name}
                            </span>
                        ))}
                    </div>
                ) : null}
                {board.status === "published" && board.permissions.canEditContent ? (
                    <div className="mt-8">
                        <Link
                            href={`/boards/${board.boardId}/edit`}
                            className="border-foreground text-14 hover:bg-foreground hover:text-background inline-block border px-6 py-3 font-medium transition-colors"
                        >
                            Edit Board
                        </Link>
                    </div>
                ) : null}
            </header>

            <div className="mx-auto mt-12 grid max-w-7xl gap-12 lg:grid-cols-[20rem_1fr]">
                <aside>
                    <p className="text-10 tracking-label text-muted-foreground font-bold uppercase">Board cover</p>
                    <div className="border-line mt-4 overflow-hidden border">
                        {cover ? (
                            <button
                                type="button"
                                onClick={() => setActiveImageIndex(0)}
                                className="group focus:ring-foreground block w-full cursor-pointer text-left transition-opacity hover:opacity-90 focus:ring-2 focus:outline-none"
                                aria-label={`View cover image of ${board.title || "Untitled Board"} in detail`}
                            >
                                <LibraryImg
                                    src={cover.url}
                                    alt={`Cover of ${board.title || "Untitled Board"}`}
                                    className="aspect-[4/3] w-full object-cover"
                                />
                            </button>
                        ) : (
                            <div className="bg-faint text-12 text-muted-foreground grid aspect-[4/3] place-items-center">
                                Default cover
                            </div>
                        )}
                    </div>
                </aside>

                <main className="space-y-12">
                    {restored.days.map((day, dayIndex) => {
                        const dayColor = dayColors[dayIndex % dayColors.length];
                        return (
                            <section
                                key={day.id}
                                aria-labelledby={`day-heading-${day.id}`}
                                className="border-line border-t pt-6"
                                style={{
                                    borderTopColor: dayColor,
                                    borderTopWidth: 3
                                }}
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-4">
                                    <h2 id={`day-heading-${day.id}`} className="font-display text-28 font-bold">
                                        Day {day.dayNumber}
                                    </h2>
                                    <div className="text-12 text-muted-foreground flex gap-3">
                                        {day.date ? <time dateTime={day.date}>{day.date}</time> : null}
                                        <span>
                                            {day.pins.length} {day.pins.length === 1 ? "activity" : "activities"}
                                        </span>
                                    </div>
                                </div>

                                {day.pins.length === 0 ? (
                                    <p className="text-13 text-muted-foreground mt-6 italic">
                                        No activities planned for this day.
                                    </p>
                                ) : (
                                    <ol className="mt-6 space-y-6">
                                        {day.pins.map((pin) => {
                                            const pinImages = restored.images
                                                .filter((image) => image.pinId === pin.id)
                                                .sort(
                                                    (first, second) =>
                                                        (first.activityOrder ?? first.order) -
                                                        (second.activityOrder ?? second.order)
                                                );
                                            const locationParts = pin.location
                                                ? [
                                                      pin.location.name !== pin.title ? pin.location.name : null,
                                                      pin.location.address,
                                                      pin.location.city,
                                                      pin.location.country
                                                  ].filter(Boolean)
                                                : [];
                                            const locationDisplay = locationParts.join(" · ");

                                            return (
                                                <li key={pin.id} className="border-line border-b pb-6 last:border-b-0">
                                                    <div className="flex items-start gap-3">
                                                        <span
                                                            className="bg-faint text-muted-foreground grid size-8 shrink-0 place-items-center rounded-sm"
                                                            title={pin.category}
                                                        >
                                                            <PinCategoryIcon
                                                                category={pin.category}
                                                                className="size-4"
                                                            />
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                                <h3 className="font-display text-foreground text-18 font-bold">
                                                                    {pin.title}
                                                                </h3>
                                                                {pin.time ? (
                                                                    <time className="text-muted-foreground text-12 font-mono">
                                                                        {pin.time}
                                                                    </time>
                                                                ) : null}
                                                            </div>

                                                            {locationDisplay ? (
                                                                <p className="text-12 text-muted-foreground mt-1 flex items-center gap-1">
                                                                    <span>📍</span>
                                                                    <span>{locationDisplay}</span>
                                                                </p>
                                                            ) : null}

                                                            {pin.description ? (
                                                                <p className="text-foreground text-13 mt-2 leading-relaxed whitespace-pre-line">
                                                                    {pin.description}
                                                                </p>
                                                            ) : null}

                                                            {pinImages.length > 0 ? (
                                                                <div
                                                                    className="mt-3 flex flex-wrap gap-2"
                                                                    aria-label={`Photos for ${pin.title}`}
                                                                >
                                                                    {pinImages.map((image, imageIndex) => (
                                                                        <button
                                                                            key={image.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const targetIndex =
                                                                                    galleryImages.findIndex(
                                                                                        (item) => item.id === image.id
                                                                                    );
                                                                                setActiveImageIndex(
                                                                                    targetIndex >= 0 ? targetIndex : 0
                                                                                );
                                                                            }}
                                                                            className="border-line focus:ring-foreground aspect-square size-20 cursor-pointer overflow-hidden rounded-sm border transition-opacity hover:opacity-90 focus:ring-2 focus:outline-none"
                                                                            aria-label={
                                                                                pinImages.length > 1
                                                                                    ? `View photo ${imageIndex + 1} for ${pin.title} in detail`
                                                                                    : `View photo for ${pin.title} in detail`
                                                                            }
                                                                        >
                                                                            <LibraryImg
                                                                                src={image.thumbnailUrl}
                                                                                alt={`${pin.title} photo`}
                                                                                className="size-full object-cover"
                                                                            />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                )}
                            </section>
                        );
                    })}
                </main>
            </div>
            {activeImageIndex !== null ? (
                <ImageDetailDialog
                    images={galleryImages}
                    initialIndex={activeImageIndex}
                    onClose={() => setActiveImageIndex(null)}
                />
            ) : null}
        </article>
    );
}
