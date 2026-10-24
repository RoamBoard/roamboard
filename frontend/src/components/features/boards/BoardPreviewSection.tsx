import BoardCreationPreview from "./BoardCreationPreview";
import CreatorSectionIntro from "./CreatorSectionIntro";
import type { BoardCreatorPayload } from "@/types/board-creator";

export default function BoardPreviewSection({
    board,
    author,
    editable,
    embedded = false
}: {
    board: BoardCreatorPayload;
    author?: string;
    editable?: boolean;
    embedded?: boolean;
}) {
    return (
        <section
            id={embedded ? undefined : "board-preview"}
            className={
                embedded ? "w-full" : "mx-auto w-full max-w-[110rem] scroll-mt-36 px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28"
            }
        >
            <div className="@container relative min-w-0">
                {!embedded ? (
                    <div className="mb-10 max-w-xl [&>header]:pb-4 [&>header>p]:max-w-md">
                        <CreatorSectionIntro
                            number="05"
                            title="BOARD PREVIEW"
                            description="The cover and the details behind your journey. Two views of the same Board."
                        />
                    </div>
                ) : null}
                <BoardCreationPreview board={board} author={author} editable={editable} />
            </div>
        </section>
    );
}
