import catalog from "../../../shared/roamboard-tags.json";

export type BoardTag = (typeof catalog.tags)[number];
// IDs are opaque catalog keys. Use getBoardTag/isBoardTagId at input boundaries.
export type BoardTagId = BoardTag["id"];

export const boardTags: readonly BoardTag[] = catalog.tags;
export const boardTagCatalogVersion = catalog.catalogVersion;

// Offer the shared profile catalog, restricted to names the API can persist.
// Legacy database names remain valid for existing selections, not new choices.
export function getAvailableBoardTags(allowedNames: readonly string[]): readonly BoardTag[] {
    const allowed = new Set(allowedNames);
    return boardTags.filter((tag) => allowed.has(tag.name));
}

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
    return filterBoardsByTags(boards, [tagId]);
}

// A board matching any selected tag is returned once, in source order.
export function filterBoardsByTags<T extends { tags: readonly BoardTagId[] }>(
    boards: readonly T[],
    tagIds: readonly BoardTagId[]
): T[] {
    const validIds = tagIds.filter(isBoardTagId);
    return boards.filter((board) => validIds.some((id) => board.tags.includes(id)));
}
