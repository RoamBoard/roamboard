import PhotoBoardCard from "@/components/features/boards/cards/PhotoBoardCard";
import type { DiscoverBoard } from "@/data/discover-boards";
import { toDiscoverPhotoBoardCard } from "./DiscoverBoardCard";

const positions = [
    "md:mt-12 xl:col-span-4 xl:col-start-5 xl:row-start-1 xl:mt-16",
    "xl:col-span-4 xl:col-start-9 xl:row-start-1 xl:mt-0",
    "md:mt-12 xl:col-span-4 xl:col-start-1 xl:row-start-2 xl:-mt-28",
    "xl:col-span-4 xl:col-start-5 xl:row-start-2 xl:mt-12",
    "md:mt-12 xl:col-span-4 xl:col-start-9 xl:row-start-2 xl:-mt-4"
];

export default function FeaturedBoards({
    boards = [],
    available = false
}: {
    boards?: readonly DiscoverBoard[];
    available?: boolean;
}) {
    if (!boards.length)
        return (
            <section id="featured-title" aria-labelledby="featured-heading" className="mt-24 mb-6">
                <h2 id="featured-heading" className="font-display text-36 font-bold">
                    This week&apos;s featured Boards
                </h2>
                <p role="status" className="text-muted-foreground mt-5">
                    {available
                        ? "No public Boards have been published yet."
                        : "Featured Boards could not be loaded. Refresh to try again."}
                </p>
            </section>
        );
    return (
        <section
            id="featured-title"
            aria-labelledby="featured-heading"
            className="@container mt-24 mb-6 grid scroll-mt-6 items-start gap-7 md:grid-cols-2 xl:grid-cols-12 xl:gap-x-7 xl:gap-y-12"
        >
            <header className="xl:col-span-4 xl:col-start-1 xl:row-start-1 xl:self-start">
                <p className="text-muted-foreground text-10 mb-3 tracking-[.16em] uppercase">Weekly selection</p>
                <h2
                    id="featured-heading"
                    className="font-display text-[clamp(2.5rem,4.4cqw,4.5rem)] leading-[0.95] font-bold tracking-tight uppercase"
                >
                    <span className="block">This</span> <span className="block">Week&apos;s</span>{" "}
                    <span className="block">Featured</span> <span className="block">Boards</span>
                </h2>
                <p className="text-muted-foreground text-14 border-line mt-5 max-w-xs border-t pt-4 leading-relaxed">
                    Community itineraries and travel journals drawing the most attention across Roamboard this week.
                </p>
            </header>
            <div className="contents">
                {boards.slice(0, 5).map((board, index) => (
                    <div key={board.id} className={`min-w-0 self-start ${positions[index]}`}>
                        <PhotoBoardCard board={toDiscoverPhotoBoardCard(board)} href={board.href} details />
                    </div>
                ))}
            </div>
        </section>
    );
}
