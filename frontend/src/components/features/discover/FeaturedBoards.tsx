import LandscapeBoardCard from "@/components/features/boards/cards/LandscapeBoardCard";
import { landscapeBoardExamples } from "@/data/board-card-examples";

// Reuse the original V3 fixtures, in the section's reading order. These are preview Boards, not API records.
const featuredBoards = ["v3-marrakech", "v3-odda", "v3-buenos-aires"]
    .map((id) => landscapeBoardExamples.find((board) => board.id === id))
    .filter((board) => board !== undefined);

const positions: Record<string, string> = {
    "v3-marrakech": "lg:top-0 lg:left-[53.76486%] lg:w-[46.23514%]",
    "v3-odda": "lg:top-[24.24242%] lg:left-0 lg:w-[46.23514%]",
    "v3-buenos-aires": "lg:top-[51.51515%] lg:left-[48.21664%] lg:w-[50.19815%]"
};

export default function FeaturedBoards() {
    return (
        <section
            id="featured-title"
            aria-labelledby="featured-heading"
            className="@container relative mt-24 mb-6 scroll-mt-6 lg:mr-[30px] lg:-ml-6 lg:aspect-[1514/825]"
        >
            {/* The desktop composition follows Figma's 1514 × 825 bounds; cards keep their own container scale. */}
            <h2
                id="featured-heading"
                className="font-display mb-8 text-[clamp(2.5rem,6vw,4rem)] leading-none font-bold lg:mb-0 lg:contents lg:text-[6.34082cqw] lg:leading-[1.02]"
            >
                <span className="lg:absolute lg:top-[0.36364%] lg:right-[49.93395%]">THIS</span>{" "}
                <span className="lg:absolute lg:top-[10.30303%] lg:right-[51.58520%]">WEEK’S</span>{" "}
                <span className="lg:absolute lg:top-[76.72727%] lg:right-[56.20872%]">FEATURED</span>{" "}
                <span className="lg:absolute lg:top-[87.03030%] lg:right-[53.50066%]">BOARDS</span>
            </h2>
            <div className="grid gap-6 lg:contents">
                {featuredBoards.map((board) => (
                    <div key={board.id} className={`min-w-0 lg:absolute ${positions[board.id]}`}>
                        <LandscapeBoardCard board={board} />
                    </div>
                ))}
            </div>
        </section>
    );
}
