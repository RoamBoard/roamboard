import type { BoardDocument, DraftSummary } from "./board-creator-api";
import type { BoardCardImage, CollageBoardCardData, PhotoBoardCardData } from "../types/board-card";
import { boardTitleLines } from "./my-boards";
import { findCountry } from "./countries";

export type SelectionSummary = DraftSummary & {
    status: "draft" | "published";
    source: "owned" | "shared";
};
export type SelectionFilter = "all" | "draft" | "published";
export type SelectionBoard = {
    summary: SelectionSummary;
    collage: CollageBoardCardData;
    photo: (PhotoBoardCardData & { image: BoardCardImage }) | null;
    document?: BoardDocument;
    destination: string;
};

export function filterSelectionBoards(
    items: readonly SelectionSummary[],
    query: string,
    status: SelectionFilter = "all"
) {
    const normalize = (value: string) =>
        value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    const words = normalize(query).trim().split(/\s+/).filter(Boolean);
    return items.filter(
        (item) =>
            (status === "all" || item.status === status) &&
            words.every((word) => normalize(item.title || "Untitled Board").includes(word))
    );
}

export function selectionEditorHref(document: BoardDocument): string | null {
    if (!document.permissions.canEditContent) return null;
    return document.status === "draft" ? `/boards/drafts/${document.boardId}` : `/boards/${document.boardId}/edit`;
}

export function parseSharedBoardId(input: string): number {
    const trimmed = input.trim();
    const path = /^\d+$/.test(trimmed)
        ? trimmed
        : (() => {
              try {
                  const url = new URL(trimmed, "https://roamboard.invalid");
                  return url.pathname.match(/^\/boards\/(?:drafts\/)?(\d+)(?:\/edit)?\/?$/)?.[1] ?? "";
              } catch {
                  return "";
              }
          })();
    const id = Number(path);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("Enter a Board link or a positive Board ID.");
    return id;
}

export function toSelectionBoard(summary: SelectionSummary, document?: BoardDocument): SelectionBoard {
    const imageUrl = (url: string) =>
        new URL(url, process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").toString();
    const activities = document?.days.flatMap((day) => day.activities) ?? [];
    const locations = activities.flatMap((activity) =>
        activity.locationConfirmed && activity.location ? [activity.location] : []
    );
    const destination = [
        ...new Set(
            locations.flatMap((location) =>
                [
                    location.city,
                    location.country ? (findCountry(location.country)?.name ?? location.country) : null
                ].filter(Boolean)
            )
        )
    ].join(", ");
    const countries = locations.map((location) => (location.country ? findCountry(location.country) : undefined));
    const country =
        countries.length && countries.every((country) => country?.code === countries[0]?.code)
            ? countries[0]
            : undefined;
    const uploaded = document
        ? [...document.images]
              .sort(
                  (a, b) =>
                      Number(b.imageId === document.coverImageId) - Number(a.imageId === document.coverImageId) ||
                      a.position - b.position
              )
              .map((image) => ({ src: imageUrl(image.thumbnailUrl), alt: `${summary.title || "Board"} photograph` }))
        : [];
    const photos = [
        ...uploaded,
        ...activities.flatMap((activity) =>
            activity.externalImage ? [{ src: activity.externalImage.url, alt: activity.title }] : []
        )
    ];
    const title = document?.title || summary.title || "Untitled Board";
    const cover =
        photos[0] ?? (summary.coverImageUrl ? { src: imageUrl(summary.coverImageUrl), alt: `${title} cover` } : null);
    const collage: CollageBoardCardData = {
        id: String(summary.boardId),
        title,
        titleLines: boardTitleLines(title, 18),
        author: summary.source === "owned" ? "you" : "",
        destination,
        destinationLabel: country?.code ?? "",
        durationDays: document?.days.length ?? 0,
        description: document?.description?.slice(0, 120) ?? "",
        themes: document?.tags.map((tag) => tag.name.slice(0, 22)).slice(0, 3) ?? [],
        highlights: activities.slice(0, 6).map((activity) => activity.title.slice(0, 24)),
        images: photos.length ? photos : cover ? [cover] : []
    };
    return {
        summary,
        document,
        collage,
        destination,
        photo: cover ? { ...collage, titleLines: boardTitleLines(title, 16), image: cover } : null
    };
}
