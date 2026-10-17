/* eslint-disable @next/next/no-img-element */
"use client";

import BoardPreviewDiagram from "./BoardPreviewDiagram";
import { createBoardPreview } from "@/lib/board-creation-preview";
import { dayColors, type BoardCreatorPayload } from "@/types/board-creator";

type Props = {
    board: BoardCreatorPayload;
    confirmedPhotoPins?: ReadonlySet<string>;
};

const editLink =
    "text-muted-foreground hover:text-foreground mt-2 inline-flex min-h-11 items-center text-[11px] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4";

export default function BoardCreationPreview({ board, confirmedPhotoPins }: Props) {
    const preview = createBoardPreview(board, confirmedPhotoPins);
    const pins = board.days.flatMap((day) => day.pins);
    const uploadedCount = board.images.filter((image) => image.source === "upload").length;
    return (
        <article aria-label="Board preview" className="@container min-w-0">
            <BoardPreviewDiagram board={board} preview={preview} />
            <div className="text-muted-foreground mt-8 flex flex-wrap justify-between gap-x-6 gap-y-2 text-[11px] leading-relaxed @min-[1100px]:ml-[22%]">
                <p>Live preview · updates as you edit</p>
                <p>
                    {board.days.length} {board.days.length === 1 ? "day" : "days"} · {pins.length}{" "}
                    {pins.length === 1 ? "activity" : "activities"} · {uploadedCount} uploaded{" "}
                    {uploadedCount === 1 ? "photo" : "photos"}
                </p>
            </div>
            <details className="border-line mt-12 border-t pt-3">
                <summary className="text-foreground/80 cursor-pointer py-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4">
                    Review full itinerary · {pins.length} {pins.length === 1 ? "activity" : "activities"}
                </summary>
                <div className="mt-6 grid min-w-0 gap-8 sm:grid-cols-2">
                    {board.days.map((day, index) => (
                        <section
                            key={day.id}
                            className="min-w-0 border-t pt-4"
                            style={{ borderColor: dayColors[index % dayColors.length] }}
                        >
                            <h4 className="text-foreground/80 text-base font-bold">Day {day.dayNumber}</h4>
                            {day.date ? <p className="text-muted-foreground mt-1 text-xs">{day.date}</p> : null}
                            <ol className="mt-5 grid gap-6">
                                {day.pins.map((pin) => (
                                    <li
                                        key={pin.id}
                                        className="min-w-0 text-xs leading-relaxed [overflow-wrap:anywhere]"
                                    >
                                        <p>
                                            <time className="text-muted-foreground mr-2 tabular-nums">
                                                {pin.time || "Time open"}
                                            </time>
                                            <strong className="font-medium">{pin.title}</strong>
                                        </p>
                                        {pin.description ? (
                                            <p className="text-muted-foreground mt-2 whitespace-pre-wrap">
                                                {pin.description}
                                            </p>
                                        ) : null}
                                        {pin.location ? (
                                            <p className="text-muted-foreground mt-2">
                                                {pin.location.name}
                                                {pin.location.address ? ` · ${pin.location.address}` : ""}
                                            </p>
                                        ) : null}
                                        {pin.source === "photo" && !confirmedPhotoPins?.has(pin.id) ? (
                                            <p className="mt-2">Photo location needs confirmation.</p>
                                        ) : null}
                                        <div
                                            className="mt-3 flex flex-wrap gap-2"
                                            aria-label={`Images for ${pin.title}`}
                                        >
                                            {board.images
                                                .filter((image) => image.pinId === pin.id)
                                                .sort(
                                                    (a, b) =>
                                                        (a.activityOrder ?? a.order) - (b.activityOrder ?? b.order)
                                                )
                                                .map((image) => (
                                                    <img
                                                        key={image.id}
                                                        src={image.thumbnailUrl}
                                                        alt={`${pin.title} photo`}
                                                        loading="lazy"
                                                        className="size-16 object-cover"
                                                    />
                                                ))}
                                        </div>
                                    </li>
                                ))}
                                {day.pins.length === 0 ? (
                                    <li className="text-muted-foreground text-xs">No activities yet</li>
                                ) : null}
                            </ol>
                        </section>
                    ))}
                    {board.days.length === 0 ? (
                        <p className="text-muted-foreground text-xs">No days added yet.</p>
                    ) : null}
                </div>
                <a href="#day-plan" className={editLink}>
                    Back to day plan
                </a>
            </details>
            <details className="border-line mt-5 border-t pt-3">
                <summary className="text-foreground/80 cursor-pointer py-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4">
                    Review all photos · {board.images.length}
                </summary>
                <ul className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3">
                    {preview.photos.map((image) => (
                        <li key={image.id} className="min-w-0">
                            <figure>
                                <img
                                    src={image.thumbnailUrl}
                                    alt="Board photo"
                                    loading="lazy"
                                    className="aspect-square w-full object-cover"
                                />
                                <figcaption className="text-muted-foreground mt-2 text-[11px] leading-relaxed [overflow-wrap:anywhere]">
                                    {image === preview.cover ? (
                                        <p className="text-foreground">Selected Board cover</p>
                                    ) : null}
                                    {image.credit ? (
                                        image.creditUrl || image.sourceUrl ? (
                                            <p>
                                                Photo by{" "}
                                                <a
                                                    href={image.creditUrl || image.sourceUrl || undefined}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="underline underline-offset-4"
                                                >
                                                    {image.credit}
                                                </a>
                                            </p>
                                        ) : (
                                            <p>Photo by {image.credit}</p>
                                        )
                                    ) : (
                                        <p>{image.source === "upload" ? "Your uploaded photo" : "Activity photo"}</p>
                                    )}
                                    {image.sourceUrl && image.sourceUrl !== image.creditUrl ? (
                                        <a
                                            href={image.sourceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex min-h-11 items-center underline underline-offset-4"
                                        >
                                            View photo source
                                        </a>
                                    ) : null}
                                </figcaption>
                            </figure>
                        </li>
                    ))}
                </ul>
                {board.images.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No photos added yet.</p>
                ) : null}
                <a href="#board-images" className={editLink}>
                    Back to Board photos
                </a>
            </details>
        </article>
    );
}
