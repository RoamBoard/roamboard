import type { Metadata } from "next";
import DiscoverExperience from "@/components/features/discover/DiscoverExperience";
import { DiscoverHero, DiscoverJourney, DiscoverFeed } from "@/components/features/discover/DiscoverContent";
import { getPublicDiscoverBoards, getFeaturedDiscoverBoards } from "@/data/discover-boards";

export const metadata: Metadata = {
    title: "Discover | Roamboard"
};

export default async function DiscoverPage() {
    const [publicBoards, featured] = await Promise.all([getPublicDiscoverBoards(), getFeaturedDiscoverBoards()]);
    return (
        <DiscoverExperience
            hero={<DiscoverHero />}
            journey={<DiscoverJourney />}
            mobileJourney={[0, 1, 2].map((panel) => (
                <DiscoverJourney key={panel} mobilePanel={panel} />
            ))}
        >
            <DiscoverFeed
                boards={publicBoards.boards}
                available={publicBoards.available}
                featured={featured.boards}
                featuredAvailable={featured.available}
            />
        </DiscoverExperience>
    );
}
