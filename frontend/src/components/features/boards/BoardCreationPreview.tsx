/* eslint-disable @next/next/no-img-element */

import { dayColors, type BoardCreatorPayload } from "@/types/board-creator";

type Props = {
    board: BoardCreatorPayload;
};

export default function BoardCreationPreview({ board }: Props) {
    const pins = board.days.flatMap((day) => day.pins);
    const uploadedImages = board.images.filter(
        (image) => image.source === "upload"
    );
    const cover = uploadedImages.find(
        (image) => image.uploadedImageId === board.coverImageId
    );
    return (
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
                <p className="text-10 tracking-label text-graphite font-bold uppercase">
                    Board cover
                </p>
                <div className="mt-4 max-w-sm">
                    {cover ? (
                        <img
                            src={cover.url}
                            alt={`Cover of ${board.title || "Untitled Board"}`}
                            className="aspect-[4/3] w-full object-cover"
                        />
                    ) : (
                        <div className="bg-faint text-12 text-graphite grid aspect-[4/3] place-items-center">
                            Default cover
                        </div>
                    )}
                </div>
            </div>

            <article
                className="border-line border-l pl-8"
                aria-label="Board preview"
            >
                <div className="flex flex-wrap items-start justify-between gap-5">
                    <div>
                        <p className="text-10 tracking-label text-stone uppercase">
                            Board preview
                        </p>
                        <h3 className="font-display text-48 mt-3 max-w-md leading-[0.9] font-bold">
                            {board.title || "Untitled Board"}
                        </h3>
                    </div>
                    <span className="border-line text-10 tracking-label border px-3 py-2 uppercase">
                        {board.visibility}
                    </span>
                </div>
                <p className="text-14 text-graphite mt-6 max-w-xl leading-6">
                    {board.description ||
                        "Your Board description will appear here."}
                </p>
                <div className="text-12 text-graphite mt-7 flex flex-wrap gap-5">
                    <span>
                        {board.days.length} day
                        {board.days.length === 1 ? "" : "s"}
                    </span>
                    <span>
                        {pins.length} pin{pins.length === 1 ? "" : "s"}
                    </span>
                    <span>
                        {uploadedImages.length} image
                        {uploadedImages.length === 1 ? "" : "s"}
                    </span>
                </div>
                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                    {board.days.map((day, index) => (
                        <section
                            key={day.id}
                            className="border-t pt-4"
                            style={{
                                borderColor: dayColors[index % dayColors.length]
                            }}
                        >
                            <h4 className="font-display text-20 font-bold">
                                Day {day.dayNumber}
                            </h4>
                            <ol className="text-12 text-graphite mt-3 grid gap-2">
                                {day.pins.slice(0, 5).map((pin) => (
                                    <li key={pin.id}>
                                        <time>{pin.time}</time> ·{" "}
                                        <span className="text-foreground">
                                            {pin.title}
                                        </span>
                                        <div
                                            className="mt-2 flex flex-wrap gap-1"
                                            aria-label={`Images for ${pin.title}`}
                                        >
                                            {board.images
                                                .filter(
                                                    (image) =>
                                                        image.pinId === pin.id
                                                )
                                                .sort(
                                                    (first, second) =>
                                                        (first.activityOrder ??
                                                            first.order) -
                                                        (second.activityOrder ??
                                                            second.order)
                                                )
                                                .map((image) => (
                                                    <img
                                                        key={image.id}
                                                        src={image.thumbnailUrl}
                                                        alt={`${pin.title} photo`}
                                                        className="size-16 object-cover"
                                                    />
                                                ))}
                                        </div>
                                    </li>
                                ))}
                                {day.pins.length === 0 ? (
                                    <li>No pins yet</li>
                                ) : null}
                            </ol>
                        </section>
                    ))}
                </div>
                <dl className="border-line mt-9 grid gap-6 border-t pt-6">
                    <div>
                        <dt className="text-10 tracking-label text-stone uppercase">
                            Tags
                        </dt>
                        <dd className="text-12 text-graphite mt-2">
                            {board.tags.join(" · ") || "None"}
                        </dd>
                    </div>
                </dl>
            </article>
        </div>
    );
}
