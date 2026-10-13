import { filterBoardsByTag, type BoardTagId } from "./board-tags";
import { previewBoards } from "./discover-preview";
import { mockBoards } from "./mock-boards";

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
            image: board.coverImage
        }))
];

export function getDiscoverPreviewBoardsByTag(tagId: BoardTagId) {
    return filterBoardsByTag(publicDiscoverPreviewBoards, tagId);
}
