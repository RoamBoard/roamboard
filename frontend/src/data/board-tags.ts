import catalog from "../../../shared/roamboard-tags.json";

export type BoardTag = (typeof catalog.tags)[number];
// IDs are opaque catalog keys. Use getBoardTag/isBoardTagId at input boundaries.
export type BoardTagId = BoardTag["id"];

export const boardTags: readonly BoardTag[] = catalog.tags;
export const boardTagCatalogVersion = catalog.catalogVersion;

const tagsById = new Map(boardTags.map((tag) => [tag.id, tag]));

if (tagsById.size !== boardTags.length) {
    throw new Error("The board tag catalog contains duplicate IDs.");
}

export function getBoardTag(id: string): BoardTag | undefined {
    return tagsById.get(id);
}

export function isBoardTagId(id: string): id is BoardTagId {
    return tagsById.has(id);
}

export function boardTagHref(id: BoardTagId): string {
    return `/discover/vibes/${encodeURIComponent(id)}`;
}

export function filterBoardsByTag<T extends { tags: readonly BoardTagId[] }>(
    boards: readonly T[],
    tagId: BoardTagId
): T[] {
    if (!isBoardTagId(tagId)) return [];
    return boards.filter((board) => board.tags.includes(tagId));
}
