import BoardCreationPreview from "./BoardCreationPreview";
import CreatorSectionIntro from "./CreatorSectionIntro";
import type { BoardCreatorPayload } from "@/types/board-creator";

export default function BoardPreviewSection({
    board,
    author,
    editable
}: {
    board: BoardCreatorPayload;
    author?: string;
    editable?: boolean;
}) {
    return (
        <section
            id="board-preview"
            className="mx-auto w-full max-w-[110rem] scroll-mt-36 px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28"
        >
            <div className="@container relative min-w-0">
                <div className="mb-10 max-w-xl [&>header]:pb-4 [&>header>p]:max-w-md">
                    <CreatorSectionIntro
                        number="05"
                        title="BOARD PREVIEW"
                        description="The cover and the details behind your journey. Two views of the same Board."
                    />
                </div>
                <BoardCreationPreview board={board} author={author} editable={editable} />
            </div>
        </section>
    );
}
