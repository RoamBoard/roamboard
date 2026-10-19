import { BoardLibraryCarousel, BoardLibrarySlide } from "@/components/features/boards/BoardLibrary";
import type { DiscoverBoard } from "@/data/discover-boards";
import type { BoardTagId } from "@/data/board-tags";
import DiscoverBoardCard from "./DiscoverBoardCard";

// Editorial samples keep their tag links and honest lack of persistent Board/account actions.
export default function DiscoverBoardLibrary({
    boards,
    title,
    activeTagId
}: {
    boards: readonly DiscoverBoard[];
    title: string;
    activeTagId?: BoardTagId;
}) {
    if (!boards.length) return null;
    return (
        <BoardLibraryCarousel
            id={`discover-library-${activeTagId ?? "samples"}`}
            title={title}
            count={boards.length}
            variant="discover"
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
