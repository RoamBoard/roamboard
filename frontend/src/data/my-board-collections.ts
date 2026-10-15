import { collageBoardExamples, compactBoardExamples, photoBoardExamples } from "./board-card-examples";
import { boardTitleLines, type GalleryBoard } from "@/lib/my-boards";
import { findCountry } from "@/lib/countries";
import type { CompactBoardCardData } from "@/types/board-card";

// Explicit visual-preview categories, never inferred from live data or persisted as account state.
// A Board can be both created and saved. Archived examples are separate from active examples.
const created: GalleryBoard[] = collageBoardExamples.map((collage, index) => ({
    collage,
    compact: compactBoardExamples[index]
}));
const archived: { compact: CompactBoardCardData }[] = photoBoardExamples.map((board) => ({
    compact: {
        id: board.id,
        title: board.title,
        titleLines: boardTitleLines(board.title, 10),
        author: board.author,
        destination: board.destination,
        destinationLabel:
            findCountry(board.destination.split(",").at(-1)?.trim() ?? "")?.code ?? board.destinationLabel,
        image: board.image
    }
}));

export const mockBoardCollections = {
    created,
    saved: [created[1], created[2], created[0]],
    archived
};
