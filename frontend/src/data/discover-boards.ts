import { cache } from "react";
import { boardTags, filterBoardsByTag, filterBoardsByTags, type BoardTagId } from "./board-tags";
import { previewBoards } from "./discover-preview";
import { mockBoards } from "./mock-boards";
import type { BoardDestination } from "@/types/board";
import type { PhotoBoardCardData } from "@/types/board-card";
import { discoveryPhoto, discoveryRequest, type DiscoveryCard, type DiscoveryResult } from "@/lib/boards-discovery";
import { loadPublicBoardPage } from "@/lib/public-discover";
import { findCountry } from "@/lib/countries";

export type DiscoverBoard = {
    id: string;
    title: string;
    description: string;
    author: string;
    tags: readonly BoardTagId[];
    image?: { url: string; alt?: string };
    destinations?: readonly BoardDestination[];
    href?: string;
    card?: PhotoBoardCardData;
};

type PublicDiscoverBoardsResult = {
    available: boolean;
    boards: DiscoverBoard[];
};

export function fromDiscoveryCard(board: DiscoveryCard): DiscoverBoard {
    const card = discoveryPhoto(board);
    const country = board.destination?.country ? findCountry(board.destination.country) : undefined;
    return {
        id: String(board.boardId),
        title: card.title,
        description: board.description,
        author: board.owner.username,
        tags: boardTags
            .filter((tag) =>
                board.tags.some((name) => name.toLowerCase() === tag.name.toLowerCase() || name === tag.id)
            )
            .map((tag) => tag.id),
        image: card.image ? { url: card.image.src, alt: card.image.alt } : undefined,
        destinations: country
            ? [
                  {
                      country: country.name,
                      countryCode: country.code,
                      cities: board.destination?.name ? [board.destination.name] : []
                  }
              ]
            : [],
        href: `/boards/${board.boardId}`,
        card
    };
}

// React shares this read across components in one server render, without caching public visibility between visits.
export const getPublicDiscoverBoards = cache(async (): Promise<PublicDiscoverBoardsResult> => {
    try {
        const boards = new Map<number, DiscoveryCard>();
        const readPage = async (page: number): Promise<void> => {
            const result = await loadPublicBoardPage(page);
            for (const board of result.items) {
                if (board.status === "published" && board.visibility === "public" && !boards.has(board.boardId))
                    boards.set(board.boardId, board);
            }
            if (!result.hasMore) return;
            if (!result.items.length || page >= 10000) throw new Error("Public Board pagination did not finish");
            await readPage(page + 1);
        };
        await readPage(1);
        return { available: true, boards: [...boards.values()].map(fromDiscoveryCard) };
    } catch {
        return { available: false, boards: [] };
    }
});

export const getFeaturedDiscoverBoards = cache(async (): Promise<PublicDiscoverBoardsResult> => {
    try {
        const result = await discoveryRequest<DiscoveryResult>("/boards/featured?period=week", {
            credentials: "omit",
            signal: AbortSignal.timeout(8000)
        });
        return {
            available: true,
            boards: result.items
                .filter((board) => board.status === "published" && board.visibility === "public")
                .slice(0, 5)
                .map(fromDiscoveryCard)
        };
    } catch {
        return { available: false, boards: [] };
    }
});

export async function getDiscoverBoardsByTags(tagIds: readonly BoardTagId[]) {
    const result = await getPublicDiscoverBoards();
    return { ...result, boards: filterBoardsByTags(result.boards, tagIds) };
}

export function filterBoardsByDestination<T extends { destinations?: readonly BoardDestination[] }>(
    boards: readonly T[],
    countryCode: string
): T[] {
    const code = findCountry(countryCode)?.code;
    if (!code) return [];
    return boards.filter((board) =>
        board.destinations?.some((destination) => findCountry(destination.countryCode)?.code === code)
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
