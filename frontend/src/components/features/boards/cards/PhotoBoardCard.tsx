import type { BoardCardActions, PhotoBoardCardData } from "@/types/board-card";
import { BoardCardFrame, BoardCardPhoto, BoardCardTitle } from "./BoardCardParts";

type Props = Pick<BoardCardActions, "href"> & { board: PhotoBoardCardData };

export default function PhotoBoardCard({ board, href }: Props) {
    return (
        <BoardCardFrame board={board} width={400} height={500} href={href} className="overflow-hidden text-white">
            <BoardCardPhoto
                image={board.image}
                sizes={
                    board.image.crop
                        ? `(max-width: 400px) ${board.image.crop.width}vw, ${Math.ceil(board.image.crop.width * 4)}px`
                        : "(max-width: 400px) 100vw, 400px"
                }
                className="absolute! inset-0"
            />
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(-13.907deg,rgba(0,0,0,0)_0%,#000_100%)]"
            />
            <BoardCardTitle
                board={board}
                className="font-body absolute top-[5.75cqw] left-[6.5cqw] text-[10cqw] leading-none font-bold"
            />
            <p className="font-body absolute top-[28.25cqw] left-[6.5cqw] text-[3.5cqw] leading-none">
                by {board.author}
            </p>
            <span
                aria-hidden="true"
                className="font-body absolute top-[98.75cqw] text-[32cqw] leading-[1.02] font-bold whitespace-nowrap text-[#ebebeb]"
                style={{ left: `${board.labelOffset ?? 40.75}%` }}
            >
                {board.destinationLabel}
            </span>
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 border border-[#565656]" />
        </BoardCardFrame>
    );
}
