import Image from "next/image";
import type { SocialBoardPreview } from "@/types/social";

type Props = {
    board: SocialBoardPreview;
};

export default function SocialBoardCard({ board }: Props) {
    return (
        <article className="border-line bg-background relative flex flex-col justify-between border p-6 pb-2">
            {/* Architectural blueprint extension lines */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
            >
                {/* Top vertical overshoot on left border */}
                <span className="bg-slate absolute -top-3 left-0 h-3 w-px" />
                {/* Bottom vertical overshoot on right border */}
                <span className="bg-slate absolute right-0 -bottom-6 h-6 w-px" />
                {/* Horizontal line extending slightly left at top */}
                <span className="bg-slate absolute top-0 -left-3 h-px w-3" />
                {/* Horizontal line extending slightly right at bottom */}
                <span className="bg-slate absolute -right-4 bottom-0 h-px w-4" />
            </div>

            {/* Header: Two-line Title & Author */}
            <div className="relative z-10">
                <h4 className="font-display text-24 sm:text-26 text-obsidian leading-none font-bold tracking-tight">
                    {board.titleLines[0]}
                    <br />
                    {board.titleLines[1]}
                </h4>
                <p className="text-10 text-graphite mt-1.5 font-medium">
                    {board.author}
                </p>
            </div>

            {/* Main content grid: 6-photo collage on left, detailed narrative & highlights on right */}
            <div className="relative z-10 mt-6 grid grid-cols-12 gap-4">
                {/* Left side: 2-column photo collage (6 images total) */}
                <div className="col-span-6 grid grid-cols-2 gap-1.5">
                    {/* Left photo column */}
                    <div className="flex flex-col gap-1.5">
                        <div className="bg-porcelain relative aspect-[3/4] w-full overflow-hidden rounded-[1px]">
                            <Image
                                src={board.images[0]?.url ?? ""}
                                alt={board.images[0]?.alt ?? ""}
                                fill
                                sizes="120px"
                                className="object-cover"
                            />
                        </div>
                        <div className="bg-porcelain relative aspect-square w-full overflow-hidden rounded-[1px]">
                            <Image
                                src={board.images[1]?.url ?? ""}
                                alt={board.images[1]?.alt ?? ""}
                                fill
                                sizes="120px"
                                className="object-cover"
                            />
                        </div>
                        <div className="bg-porcelain relative aspect-square w-full overflow-hidden rounded-[1px]">
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
                        <div className="bg-porcelain relative aspect-square w-full overflow-hidden rounded-[1px]">
                            <Image
                                src={board.images[3]?.url ?? ""}
                                alt={board.images[3]?.alt ?? ""}
                                fill
                                sizes="120px"
                                className="object-cover"
                            />
                        </div>
                        <div className="bg-porcelain relative aspect-square w-full overflow-hidden rounded-[1px]">
                            <Image
                                src={board.images[4]?.url ?? ""}
                                alt={board.images[4]?.alt ?? ""}
                                fill
                                sizes="120px"
                                className="object-cover"
                            />
                        </div>
                        <div className="bg-porcelain relative aspect-[3/4] w-full overflow-hidden rounded-[1px]">
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

                {/* Right side: Duration, Narrative, List tags, Highlights, and Saved stats */}
                <div className="col-span-6 flex flex-col justify-between text-right">
                    <div>
                        <div className="font-display text-14 text-obsidian font-bold">
                            {board.duration}
                        </div>

                        <p className="text-11 text-obsidian/90 mt-2 leading-relaxed">
                            {board.quote}
                        </p>

                        {/* List tags */}
                        <div className="text-10 text-graphite mt-3 space-y-0.5">
                            {board.tags.map((tag, idx) => (
                                <div key={idx}>- {tag}</div>
                            ))}
                        </div>

                        {/* Vibes list */}
                        {board.vibes && board.vibes.length > 0 && (
                            <div className="mt-3">
                                <div className="text-10 tracking-label text-graphite font-bold uppercase">
                                    Vibe:
                                </div>
                                <div className="text-10 text-stone mt-0.5 leading-tight">
                                    {board.vibes.join(" · ")}
                                </div>
                            </div>
                        )}

                        {/* Highlights list */}
                        <div className="mt-3.5">
                            <div className="text-10 tracking-label text-graphite font-bold uppercase">
                                Highlights:
                            </div>
                            <div className="text-10 text-stone mt-1 space-y-0.5 leading-tight">
                                {board.highlights.map((h, idx) => (
                                    <div key={idx}>{h}</div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="text-10 text-stone mt-4 italic">
                        {board.savedCount}
                    </div>
                </div>
            </div>

            {/* Huge watermark at bottom (JPN, FRA, THA) */}
            <div className="pointer-events-none mt-2 flex justify-end select-none">
                <span className="font-display text-72 sm:text-80 text-faint/80 leading-none font-black tracking-tight uppercase">
                    {board.countryCode}
                </span>
            </div>
        </article>
    );
}
