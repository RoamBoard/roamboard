import BoardCreationPreview from "./BoardCreationPreview";
import CreatorSectionIntro from "./CreatorSectionIntro";
import type { BoardCreatorPayload } from "@/types/board-creator";

export default function BoardPreviewSection({ board }: { board: BoardCreatorPayload }) {
    return (
        <section
            id="board-preview"
            className="mx-auto w-full max-w-[110rem] scroll-mt-36 px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28"
        >
            <div className="@container relative min-w-0">
                <div className="mb-8 @min-[1100px]:absolute @min-[1100px]:inset-y-0 @min-[1100px]:left-0 @min-[1100px]:mb-0 @min-[1100px]:w-[20%] @min-[1100px]:[&>header]:h-full">
                    <CreatorSectionIntro
                        number="05"
                        title="BOARD PREVIEW"
                        description="A final look at the trip you’ve built, just to make sure everything feels exactly how you want it."
                    />
                </div>
                <BoardCreationPreview board={board} />
            </div>
        </section>
    );
}
