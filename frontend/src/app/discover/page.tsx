import type { Metadata } from "next";
import DiscoverExperience from "@/components/features/discover/DiscoverExperience";
import {
    DiscoverHero,
    DiscoverJourney,
    DiscoverFeed
} from "@/components/features/discover/DiscoverContent";

export const metadata: Metadata = {
    title: "Discover | Roamboard"
};

export default function DiscoverPage() {
    return (
        <DiscoverExperience
            hero={<DiscoverHero />}
            journey={<DiscoverJourney />}
        >
            <DiscoverFeed />
        </DiscoverExperience>
    );
}
