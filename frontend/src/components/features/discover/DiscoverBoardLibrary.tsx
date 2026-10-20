import { collectionHref } from "@/lib/board-collections";
import { BoardLibraryCarousel, BoardLibrarySlide } from "@/components/features/boards/BoardLibrary";
import type { DiscoverBoard } from "@/data/discover-boards";
import { getBoardTag, type BoardTagId } from "@/data/board-tags";
import DiscoverBoardCard from "./DiscoverBoardCard";

// Reuse the shared carousel for public Board summaries.
export default function DiscoverBoardLibrary({
    boards: allBoards,
    title,
    activeTagId
}: {
    boards: readonly DiscoverBoard[];
    title: string;
    activeTagId?: BoardTagId;
}) {
    const boards = allBoards.slice(0, 10);
    if (!boards.length) return null;
    return (
        <BoardLibraryCarousel
            id={`discover-library-${activeTagId ?? "samples"}`}
            title={title}
            count={boards.length}
            totalCount={allBoards.length}
            variant="discover"
            viewAllHref={
                activeTagId
                    ? collectionHref("category", { tag: getBoardTag(activeTagId)?.name ?? activeTagId })
                    : undefined
            }
        >
            {boards.map((board, index) => (
                <BoardLibrarySlide
                    key={board.id}
                    title={board.title}
                    index={index}
                    count={boards.length}
                    variant="discover"
                >
                    <DiscoverBoardCard board={board} activeTagId={activeTagId} />
                </BoardLibrarySlide>
            ))}
        </BoardLibraryCarousel>
    );
}
