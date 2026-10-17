import type { BoardCreatorPayload, BoardImageDraft } from "@/types/board-creator";
import type { CollageBoardCardData } from "@/types/board-card";
import { boardTitleLines } from "@/lib/my-boards";
import { findCountry } from "@/lib/countries";

function formattedDate(value: string | null): string | undefined {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const date = new Date(`${value}T12:00:00Z`);
    if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) return;
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    }).format(date);
}

function descriptionExcerpt(value: string): string {
    // A fixed card excerpt must not split an emoji's UTF-16 pair.
    return value
        .trim()
        .slice(0, 120)
        .replace(/[\uD800-\uDBFF]$/, "");
}

export function createBoardPreview(
    board: BoardCreatorPayload,
    confirmedPhotoPins: ReadonlySet<string> = new Set()
): {
    cover: BoardImageDraft | undefined;
    photos: BoardImageDraft[];
    destination: string;
    countryLabel: string;
    dateLabel: string;
    card: CollageBoardCardData;
} {
    const title = board.title.trim() || "Untitled Board";
    const cover = board.images.find(
        (image) => image.source === "upload" && image.uploadedImageId === board.coverImageId
    );
    const ordered = [...board.images].sort((a, b) => a.order - b.order);
    const photos = [...(cover ? [cover] : []), ...ordered.filter((image) => image !== cover)];
    const collagePhotos = photos.filter(
        (image, index, all) => all.findIndex((other) => other.url === image.url) === index
    );
    const locations = board.days
        .flatMap((day) => day.pins)
        .filter((pin) => pin.source !== "photo" || confirmedPhotoPins.has(pin.id))
        .flatMap((pin) => (pin.location ? [pin.location] : []));
    const countries = locations.map((location) => findCountry(location.countryCode || location.country || ""));
    const countryLabel =
        countries.length > 0 && countries.every((country) => country && country.code === countries[0]?.code)
            ? countries[0]!.code
            : "";
    const destination = [
        ...new Set(
            locations.flatMap((location, index) =>
                [location.city?.trim(), countries[index]?.name || location.country?.trim()].filter(
                    (value): value is string => Boolean(value)
                )
            )
        )
    ].join(" · ");
    const dates = board.days.flatMap((day) => formattedDate(day.date) ?? []);
    const undated = board.days.length - dates.length;
    const dateLabel =
        dates.length === 0
            ? "Dates open"
            : [...new Set(dates), ...(undated ? [`${undated} ${undated === 1 ? "day" : "days"} undated`] : [])].join(
                  " · "
              );
    return {
        cover,
        photos,
        destination: destination || "Destination not added",
        countryLabel,
        dateLabel,
        card: {
            id: "creator-preview",
            title,
            titleLines: boardTitleLines(title, 18).map((line) => line.replace(/[\uD800-\uDBFF](?=…|$)/g, "")),
            author: "",
            destination: destination || "Destination not added",
            destinationLabel: countryLabel,
            durationDays: board.days.length,
            description: descriptionExcerpt(board.description),
            themes: board.tags,
            highlights: [],
            images: collagePhotos.slice(0, 6).map((image) => ({
                src: image.url,
                alt: image === cover ? `Cover of ${title}` : `${title} trip photo`
            }))
        }
    };
}
