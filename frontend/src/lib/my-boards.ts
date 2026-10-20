import type { BoardDocument, PublishedSummary } from "./board-creator-api";
import { findCountry } from "./countries";
import { toPhotoBoardCard } from "./photo-board-card";
import type {
    CollageBoardCardData,
    CompactBoardCardData,
    PhotoBoardCardData,
    PhotoBoardCardProps
} from "../types/board-card";

export type GalleryBoard = {
    collage: CollageBoardCardData;
    compact: CompactBoardCardData;
    photo?: PhotoBoardCardData;
    ownership?: PhotoBoardCardProps["ownership"];
    href?: string;
    editHref?: string;
    savedByMe?: boolean;
};

export function filterGalleryBoards(boards: readonly GalleryBoard[], query: string) {
    const normalize = (value: string) =>
        value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    const words = normalize(query).trim().split(/\s+/).filter(Boolean);
    return boards.filter(({ collage: board, photo }) => {
        const text = normalize(
            [
                board.title,
                board.destination,
                board.destinationLabel,
                board.author,
                ...board.themes,
                photo?.title,
                photo?.destination,
                photo?.destinationLabel,
                photo?.author,
                ...(photo?.tags ?? [])
            ].join(" ")
        );
        return words.every((word) => text.includes(word));
    });
}

export function boardTitleLines(title: string, width: number) {
    const lines = title.split(/\s+/).reduce<string[]>((result, word) => {
        const last = result.at(-1);
        if (last && `${last} ${word}`.length <= width) return [...result.slice(0, -1), `${last} ${word}`];
        return [...result, word.length > width ? `${word.slice(0, width - 1)}…` : word];
    }, []);
    return lines.length > 2 ? [lines[0], `${lines[1].slice(0, width - 1)}…`] : lines;
}

export function toGalleryBoard(summary: PublishedSummary, document: BoardDocument): GalleryBoard {
    const activities = document.days.flatMap((day) => day.activities);
    const locations = document.destination
        ? [document.destination]
        : activities.flatMap((activity) => (activity.location ? [activity.location] : []));
    const country = locations
        .map((location) => (location.country ? findCountry(location.country) : undefined))
        .find(Boolean);
    const destination = document.destination
        ? [document.destination.name, findCountry(document.destination.country)?.name].filter(Boolean).join(", ")
        : [...new Set(locations.flatMap((location) => [location.city, location.country].filter(Boolean)))].join(", ");
    const imageUrl = (url: string) =>
        new URL(url, process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").toString();
    const images = [
        ...document.images.filter((image) => image.imageId === document.coverImageId),
        ...document.images.filter((image) => image.imageId !== document.coverImageId)
    ].map((image) => ({ src: imageUrl(image.url), alt: `${summary.title || "Board"} trip photo` }));
    const externalImages = activities.flatMap((activity) =>
        activity.externalImage ? [{ src: activity.externalImage.url, alt: activity.title }] : []
    );
    const photos = [...images, ...externalImages];
    const title = summary.title || "Untitled Board";
    const collage: CollageBoardCardData = {
        id: String(summary.boardId),
        title,
        titleLines: boardTitleLines(title, 18),
        author: "you",
        destination: destination || "Destination not added",
        destinationLabel: country?.code ?? "",
        durationDays: document.days.length,
        description: (document.description ?? "").slice(0, 120),
        themes: document.tags.slice(0, 3).map((tag) => tag.name.slice(0, 22)),
        highlights: activities.slice(0, 6).map((activity) => activity.title.slice(0, 20)),
        images: photos
    };
    return {
        collage,
        photo: toPhotoBoardCard(document),
        // This adapter is used by the authenticated owner-published list, not public search or saved lists.
        ownership: "owner",
        compact: {
            id: collage.id,
            title,
            titleLines: boardTitleLines(title, 10),
            author: collage.author,
            destination: collage.destination,
            destinationLabel: collage.destinationLabel,
            image: photos[0] ?? { src: "/globe.svg", alt: "No Board cover added" }
        },
        href: `/boards/${summary.boardId}`,
        editHref: document.permissions.canEditContent ? `/boards/${summary.boardId}/edit` : undefined,
        savedByMe: document.savedByMe
    };
}

export function filterLibraryBoards<T extends { compact: CompactBoardCardData }>(
    boards: readonly T[],
    query: string
): T[] {
    const normalize = (value: string) =>
        value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    const words = normalize(query).trim().split(/\s+/).filter(Boolean);
    return boards.filter(({ compact: board }) => {
        const text = normalize([board.title, board.author, board.destination, board.destinationLabel].join(" "));
        return words.every((word) => text.includes(word));
    });
}
