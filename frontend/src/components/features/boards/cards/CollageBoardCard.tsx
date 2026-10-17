import type { BoardCardActions, CollageBoardCardData } from "@/types/board-card";
import {
    BoardCardBookmark,
    BoardCardFrame,
    BoardCardGraphic,
    BoardCardPhoto,
    BoardCardTitle,
    cardMeasure
} from "./BoardCardParts";

type Props = BoardCardActions & { board: CollageBoardCardData; preview?: boolean };

const photoSlots = [
    "left-[1.136cqw] top-[30.455cqw] h-[29.773cqw] w-[14.545cqw]",
    "left-[1.136cqw] top-[61.136cqw] h-[21.818cqw] w-[14.545cqw]",
    "left-[1.136cqw] top-[83.864cqw] h-[24.318cqw] w-[14.545cqw]",
    "left-[16.591cqw] top-[25cqw] h-[18.636cqw] w-[14.545cqw]",
    "left-[16.591cqw] top-[44.773cqw] h-[24.318cqw] w-[14.545cqw]",
    "left-[16.591cqw] top-[70cqw] h-[22.045cqw] w-[14.545cqw]"
];

export default function CollageBoardCard({ board, href, bookmarked, onBookmark, preview = false }: Props) {
    return (
        <BoardCardFrame board={board} width={440} height={560} href={href}>
            {/* cqw measurements scale the complete 440 × 560 Figma composition together. */}
            <div className="bg-background absolute inset-[0_9.98%_11.28%_6.89%] overflow-hidden">
                <span
                    aria-hidden="true"
                    className="text-card-watermark font-body absolute top-[90.227cqw] text-[29.091cqw] leading-[1.02] font-bold whitespace-nowrap"
                    style={{ left: `${(((board.labelOffset ?? 44.773) - 6.89) / 83.13) * 100}%` }}
                >
                    {board.destinationLabel}
                </span>
                <BoardCardTitle
                    board={board}
                    className="font-display text-card-title absolute top-[2.5cqw] left-[1.066cqw] max-w-[80cqw] text-[8.182cqw] leading-[.9] font-bold"
                />
                {!preview && (
                    <p className="font-display text-card-subtle absolute top-[17.955cqw] left-[1.066cqw] text-[2.273cqw] leading-[1.1] font-bold">
                        by {board.author}
                    </p>
                )}
                <p className="font-display text-card-title absolute top-[22.273cqw] right-[2.291cqw] text-right text-[3.182cqw] leading-[1.1] font-bold">
                    {board.durationDays} {board.durationDays === 1 ? "day" : "days"}
                </p>
                <p
                    className={`text-card-description absolute top-[27.045cqw] right-[2.291cqw] text-right text-[3.182cqw] leading-[1.1] font-medium whitespace-pre-line ${preview ? "line-clamp-6 break-words" : ""}`}
                    style={cardMeasure(board.descriptionWidth ?? 186, 440)}
                >
                    {board.description || (preview ? "Add a description to set the scene." : "")}
                </p>
                <ul
                    className={`text-card-subtle absolute top-[48.636cqw] right-[2.291cqw] text-right text-[2.727cqw] leading-[1.3] font-medium ${preview ? "max-w-[40cqw] [&>li]:truncate" : ""}`}
                >
                    {board.themes.map((theme) => (
                        <li key={theme}>- {theme}</li>
                    ))}
                </ul>
                {!preview && (
                    <p className="text-card-description absolute top-[64.091cqw] right-[2.291cqw] text-[2.273cqw] leading-[1.2] font-medium">
                        Highlights:
                    </p>
                )}
                {!preview && (
                    <p className="text-card-subtle absolute top-[67.727cqw] right-[2.291cqw] max-w-[25cqw] text-right text-[2.273cqw] leading-[1.2]">
                        {board.highlights.map((highlight, index) => (
                            <span key={`${index}-${highlight}`} className="block">
                                {highlight}
                            </span>
                        ))}
                    </p>
                )}
                {!preview && board.savedCount !== undefined && (
                    <p className="text-card-subtle absolute top-[89.545cqw] right-[2.291cqw] text-[2.273cqw] leading-[1.02] font-bold">
                        Saved by {new Intl.NumberFormat("en-US").format(board.savedCount)} travelers
                    </p>
                )}
                {preview &&
                    photoSlots.map((slot, index) =>
                        !board.images[index] ? (
                            <div
                                key={index}
                                aria-hidden="true"
                                className={`bg-faint/60 border-line/60 absolute border border-dashed ${slot}`}
                            />
                        ) : null
                    )}
                {board.images.slice(0, 6).map((image, index) => (
                    <div key={`${index}-${image.src}`} className={`absolute ${photoSlots[index]}`}>
                        <BoardCardPhoto image={image} sizes="(max-width: 440px) 15vw, 64px" className="h-full w-full" />
                    </div>
                ))}
                <BoardCardGraphic
                    asset="v1-tokyo-line28.svg"
                    className="bg-card-divider absolute top-[92.614cqw] left-[48.566cqw] h-[.114cqw] w-[32.273cqw]"
                />
            </div>
            {!preview && (
                <BoardCardBookmark
                    title={board.title}
                    appearance="collage"
                    bookmarked={bookmarked}
                    onBookmark={onBookmark}
                    className="top-[2.432cqw] left-[84.79cqw] h-[3.958cqw] w-[2.85cqw] [--bookmark-height:3.958cqw] [--bookmark-width:2.85cqw]"
                />
            )}
            <BoardCardGraphic
                asset="v1-tokyo-line29.svg"
                className="bg-card-line absolute top-[88.72%] left-[28.74%] h-[.227cqw] w-[71.26%]"
            />
            <BoardCardGraphic
                asset="v1-tokyo-line30.svg"
                className="bg-card-rule absolute top-[16.25%] left-[90.27%] h-[83.75%] w-[.227cqw]"
            />
            <BoardCardGraphic
                asset="v1-tokyo-line31.svg"
                className="bg-card-rule absolute top-0 left-[6.89%] h-[44.74%] w-[.227cqw]"
            />
            <BoardCardGraphic
                asset="v1-tokyo-line32.svg"
                className="bg-card-line absolute top-0 left-0 h-[.227cqw] w-[39.19%]"
            />
        </BoardCardFrame>
    );
}
