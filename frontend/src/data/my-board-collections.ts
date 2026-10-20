import { collageBoardExamples, compactBoardExamples } from "./board-card-examples";
import type { GalleryBoard } from "@/lib/my-boards";
import { toEditorialPhotoBoardCard } from "@/lib/photo-board-card";

// Explicit visual-preview categories, never inferred from live data or persisted as account state.
// A Board can be both created and saved.
const created: GalleryBoard[] = collageBoardExamples.map((collage, index) => ({
    collage,
    photo: toEditorialPhotoBoardCard(collage),
    compact: compactBoardExamples[index]
}));

export const mockBoardCollections = {
    created,
    saved: [created[1], created[2], created[0]]
};
