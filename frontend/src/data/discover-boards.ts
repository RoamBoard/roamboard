import { filterBoardsByTag, filterBoardsByTags, type BoardTagId } from "./board-tags";
import { previewBoards } from "./discover-preview";
import { mockBoards } from "./mock-boards";
import type { BoardDestination } from "@/types/board";

export type DiscoverBoard = {
    id: string;
    title: string;
    description: string;
    author: string;
    tags: readonly BoardTagId[];
    image?: { url: string; alt?: string };
    destinations?: readonly BoardDestination[];
};

type PublicDiscoverBoardsResult = {
    available: boolean;
    boards: DiscoverBoard[];
};

// Live read boundary: implement using the agreed public Boards API contract.
// Never substitute the preview fixtures below for persisted public Boards.
async function getPublicDiscoverBoards(): Promise<PublicDiscoverBoardsResult> {
    return { available: false, boards: [] };
}

export async function getDiscoverBoardsByTags(tagIds: readonly BoardTagId[]) {
    const result = await getPublicDiscoverBoards();
    return { ...result, boards: filterBoardsByTags(result.boards, tagIds) };
}

export function filterBoardsByDestination<T extends { destinations?: readonly BoardDestination[] }>(
    boards: readonly T[],
    countryCode: string
): T[] {
    const code = countryCode.toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return [];
    return boards.filter((board) =>
        board.destinations?.some((destination) => destination.countryCode.toUpperCase() === code)
    );
}

export async function getDiscoverBoardsByDestination(countryCode: string) {
    const result = await getPublicDiscoverBoards();
    return {
        ...result,
        boards: filterBoardsByDestination(result.boards, countryCode)
    };
}

// One preview read boundary for tag pages. Replace it with the agreed public
// Discover API when available; current fixtures have no persistence or session.
export const publicDiscoverPreviewBoards = [
    ...previewBoards.map((board) => ({
        id: board.id,
        title: board.title,
        description: board.description,
        author: board.author,
        tags: board.tags,
        image: { url: board.photo.src, alt: board.photo.alt }
    })),
    ...mockBoards
        .filter((board) => board.visibility === "public")
        .map((board) => ({
            id: board.id,
            title: board.title,
            description: board.description,
            author: "Sample traveller",
            tags: board.tags,
            destinations: board.destinations,
            image: board.coverImage
        }))
];

export function getDiscoverPreviewBoardsByTag(tagId: BoardTagId) {
    return filterBoardsByTag(publicDiscoverPreviewBoards, tagId);
}
