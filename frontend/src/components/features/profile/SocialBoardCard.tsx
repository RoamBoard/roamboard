import Image from "next/image";
import type { SocialBoardPreview } from "@/types/social";
import { getBoardTag } from "@/data/board-tags";

type Props = {
    board: SocialBoardPreview;
};

export default function SocialBoardCard({ board }: Props) {
    return (
        <article className="bg-background relative flex flex-col overflow-visible px-6 pt-6 pb-6">
            {/* Main content grid: Left side (Header & 6-photo collage), Right side (Narrative, highlights, stats, watermark) */}
            <div className="relative z-10 grid grid-cols-12 gap-5">
                {/* Left side: Header + 2-column photo collage */}
                <div className="col-span-6 flex flex-col">
                    {/* Header: Two-line Title & Author with generous margins from lines */}
                    <div className="relative pt-6 pb-5 pl-6">
                        {/* Top horizontal drafting line */}
                        <span
                            aria-hidden="true"
                            className="bg-line pointer-events-none absolute top-0 right-0 -left-6 h-px"
                        />
                        {/* Left vertical drafting line: begins 20px above top line and continues down through header */}
                        <span
                            aria-hidden="true"
                            className="bg-line pointer-events-none absolute -top-5 bottom-0 left-0 w-px"
                        />

                        <h4 className="font-display text-24 sm:text-26 text-foreground leading-none font-bold tracking-tight">
                            {board.titleLines[0]}
                            <br />
                            {board.titleLines[1]}
                        </h4>
                        <p className="text-10 text-muted-foreground mt-2 font-medium">
                            {board.author}
                        </p>
                    </div>

                    {/* 6-Photo Collage: 2 sub-columns */}
                    <div className="grid grid-cols-2 gap-1.5">
                        {/* Left photo column */}
                        <div className="relative flex flex-col gap-1.5 pl-6">
                            {/* Photo 1: vertical line continues down from header and terminates at the bottom edge */}
                            <div className="relative">
                                <span
                                    aria-hidden="true"
                                    className="bg-line pointer-events-none absolute top-0 bottom-0 -left-6 w-px"
                                />
                                <div className="bg-faint relative aspect-[3/4] w-full overflow-hidden rounded-[1px]">
                                    <Image
                                        src={board.images[0]?.url ?? ""}
                                        alt={board.images[0]?.alt ?? ""}
                                        fill
                                        sizes="120px"
                                        className="object-cover"
                                    />
                                </div>
                            </div>
                            <div className="bg-faint relative aspect-square w-full overflow-hidden rounded-[1px]">
                                <Image
                                    src={board.images[1]?.url ?? ""}
                                    alt={board.images[1]?.alt ?? ""}
                                    fill
                                    sizes="120px"
                                    className="object-cover"
                                />
                            </div>
                            <div className="bg-faint relative aspect-square w-full overflow-hidden rounded-[1px]">
                                <Image
                                    src={board.images[2]?.url ?? ""}
                                    alt={board.images[2]?.alt ?? ""}
                                    fill
                                    sizes="120px"
                                    className="object-cover"
                                />
                            </div>
                        </div>

                        {/* Right photo column */}
                        <div className="flex flex-col gap-1.5">
                            <div className="bg-faint relative aspect-square w-full overflow-hidden rounded-[1px]">
                                <Image
                                    src={board.images[3]?.url ?? ""}
                                    alt={board.images[3]?.alt ?? ""}
                                    fill
                                    sizes="120px"
                                    className="object-cover"
                                />
                            </div>
                            <div className="bg-faint relative aspect-square w-full overflow-hidden rounded-[1px]">
                                <Image
                                    src={board.images[4]?.url ?? ""}
                                    alt={board.images[4]?.alt ?? ""}
                                    fill
                                    sizes="120px"
                                    className="object-cover"
                                />
                            </div>
                            <div className="bg-faint relative aspect-[3/4] w-full overflow-hidden rounded-[1px]">
                                <Image
                                    src={board.images[5]?.url ?? ""}
                                    alt={board.images[5]?.alt ?? ""}
                                    fill
                                    sizes="120px"
                                    className="object-cover"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right side: Duration, Narrative, List tags, Highlights, Saved stats, and Watermark */}
                <div className="relative col-span-6 flex flex-col justify-between pt-16 pr-8 text-right sm:pt-20 sm:pr-10">
                    {/* Right vertical drafting line: starts above duration and extends down past watermark */}
                    <span
                        aria-hidden="true"
                        className="bg-line pointer-events-none absolute -top-4 right-2 -bottom-16 w-px"
                    />

                    <div className="flex flex-col">
                        <div className="font-display text-14 text-foreground font-bold">
                            {board.duration}
                        </div>

                        <p className="text-11 text-foreground/90 mt-2.5 leading-relaxed">
                            {board.quote}
                        </p>

                        {/* List tags */}
                        <div className="text-10 text-muted-foreground mt-3.5 space-y-0.5">
                            {board.tags.map((tagId, idx) => {
                                const catalogTag = getBoardTag(tagId);
                                return (
                                    <div key={idx}>
                                        - {catalogTag ? catalogTag.name : tagId}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Highlights list */}
                        <div className="mt-4">
                            <div className="text-10 tracking-label text-muted-foreground font-bold uppercase">
                                Highlights:
                            </div>
                            <div className="text-10 text-muted-foreground mt-1 space-y-0.5 leading-tight">
                                {board.highlights.map((h, idx) => (
                                    <div key={idx}>{h}</div>
                                ))}
                            </div>
                        </div>

                        {/* Divider above saved count with generous spacing */}
                        <div className="mt-6">
                            <span
                                aria-hidden="true"
                                className="bg-line pointer-events-none mb-2 ml-auto block h-px w-[85%]"
                            />
                            <div className="text-10 text-muted-foreground font-medium">
                                {board.savedCount}
                            </div>
                        </div>
                    </div>

                    {/* Watermark at bottom of right column & bottom horizontal drafting line */}
                    <div className="pointer-events-none relative mt-4 flex justify-end select-none">
                        {/* Bottom horizontal drafting line: starts under 2nd photo column, cuts through lower watermark, crosses right vertical line to form crosshair */}
                        <span
                            aria-hidden="true"
                            className="bg-line pointer-events-none absolute -right-8 bottom-3.5 -left-[45%] h-px"
                        />
                        <span className="font-display text-72 sm:text-80 text-faint/80 leading-none font-black tracking-tight uppercase">
                            {board.countryCode}
                        </span>
                    </div>
                </div>
            </div>
        </article>
    );
}
