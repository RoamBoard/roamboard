import type { BoardCardActions, CompactBoardCardData } from "@/types/board-card";
import { BoardCardBookmark, BoardCardFrame, BoardCardGraphic, BoardCardPhoto, BoardCardTitle } from "./BoardCardParts";

type Props = BoardCardActions & { board: CompactBoardCardData };

export default function CompactBoardCard({ board, href, bookmarked, onBookmark }: Props) {
    return (
        <BoardCardFrame board={board} width={180} height={340} href={href} className="bg-background overflow-hidden">
            <BoardCardPhoto
                image={board.image}
                sizes="131px"
                className="absolute! top-[.556cqw] left-[13.333cqw] h-[30cqw] w-[72.778cqw] rounded-b-[50%_100%]"
            />
            <BoardCardTitle
                board={board}
                className="font-display text-card-title absolute top-[36.111cqw] left-0 w-full text-center text-[17.778cqw] leading-[.9] font-bold"
            />
            <p className="font-display text-card-subtle absolute top-[71.111cqw] left-0 w-full text-center text-[5.556cqw] leading-[1.1] font-bold">
                by {board.author}
            </p>
            <span
                aria-hidden="true"
                className="font-body text-card-watermark absolute top-[87.778cqw] left-1/2 -translate-x-1/2 rotate-180 text-[26.667cqw] leading-[1.02] font-bold whitespace-nowrap [text-orientation:mixed] [writing-mode:vertical-rl]"
            >
                {board.destinationLabel}
            </span>
            <BoardCardGraphic
                asset="v2-tokyo-line32.svg"
                className="bg-card-line absolute top-[.389cqw] left-0 h-[.278cqw] w-full"
            />
            <BoardCardGraphic
                asset="v2-tokyo-line33.svg"
                className="bg-card-line absolute top-[82.5cqw] left-[22.222cqw] h-[.278cqw] w-[55.556cqw]"
            />
            <div
                className="pointer-events-none absolute inset-0 z-20"
                style={{ translate: `0 ${((board.footerOffset ?? 0) / 180) * 100}cqw` }}
            >
                <BoardCardGraphic
                    asset="v2-tokyo-line34.svg"
                    className="bg-card-line absolute top-[145.778cqw] left-[36.111cqw] h-[.278cqw] w-[27.778cqw]"
                />
                <BoardCardBookmark
                    title={board.title}
                    appearance="compact"
                    bookmarked={bookmarked}
                    onBookmark={onBookmark}
                    className="top-[168.333cqw] left-[46.667cqw] h-[8.333cqw] w-[6.111cqw] [--bookmark-height:8.333cqw] [--bookmark-width:6.111cqw]"
                />
            </div>
        </BoardCardFrame>
    );
}
