import type { CSSProperties } from "react";
import type { BoardCardActions, LandscapeBoardCardData } from "@/types/board-card";
import { BoardCardBookmark, BoardCardFrame, BoardCardPhoto, BoardCardTitle } from "./BoardCardParts";

type Props = BoardCardActions & { board: LandscapeBoardCardData };

export default function LandscapeBoardCard({ board, href, bookmarked, onBookmark }: Props) {
    const width = board.referenceWidth ?? 700;
    // One design pixel expressed in container units keeps both approved widths accurate.
    const units = { "--u": `${100 / width}cqw` } as CSSProperties;
    return (
        <div style={units}>
            <BoardCardFrame
                board={board}
                width={width}
                height={400}
                href={href}
                className="bg-background overflow-hidden"
            >
                <BoardCardPhoto
                    image={board.image}
                    sizes="300px"
                    className="absolute! top-0 left-0 h-full w-[calc(300*var(--u))]"
                />
                <BoardCardTitle
                    board={board}
                    className="font-display text-foreground absolute top-[calc(20*var(--u))] left-[calc(330*var(--u))] text-[length:calc(64*var(--u))] leading-none font-bold [&>span+span]:-mt-[calc(14*var(--u))]"
                />
                <p className="font-display text-card-author absolute top-[calc(134*var(--u))] left-[calc(334*var(--u))] text-[length:calc(12*var(--u))] leading-[1.1]">
                    by {board.author}
                </p>
                <p className="text-card-subtle absolute top-[calc(167*var(--u))] left-[calc(330*var(--u))] max-w-[calc(340*var(--u))] text-[length:calc(12*var(--u))] leading-none font-medium">
                    {board.descriptionLines
                        ? board.descriptionLines.map((line) => (
                              <span key={line} className="block">
                                  {line}
                              </span>
                          ))
                        : board.description}
                </p>
                <ul
                    className={`text-card-subtle absolute top-[calc(213*var(--u))] left-[calc(330*var(--u))] ${board.highlightFontSize === 12 ? "text-[length:calc(12*var(--u))]" : "text-[length:calc(11*var(--u))]"} leading-[1.2]`}
                >
                    {board.highlights.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
                <span
                    aria-hidden="true"
                    className="font-body text-card-watermark absolute top-[calc(294*var(--u))] text-[length:calc(128*var(--u))] leading-[1.02] font-bold whitespace-nowrap"
                    style={{ left: `${board.labelOffset ?? (width === 760 ? 68.553 : 61.857)}%` }}
                >
                    {board.destinationLabel}
                </span>
                <BoardCardBookmark
                    title={board.title}
                    appearance="landscape"
                    bookmarked={bookmarked}
                    onBookmark={onBookmark}
                    className={`top-[calc(19.3*var(--u))] ${width === 760 ? "right-[calc(14.75*var(--u))]" : "right-[calc(16.75*var(--u))]"} h-[calc(20.5*var(--u))] w-[calc(14.5*var(--u))] [--bookmark-height:calc(20.5*var(--u))] [--bookmark-width:calc(14.5*var(--u))]`}
                />
                <span
                    aria-hidden="true"
                    className="border-card-border pointer-events-none absolute inset-0 border-[.5px]"
                />
            </BoardCardFrame>
        </div>
    );
}
