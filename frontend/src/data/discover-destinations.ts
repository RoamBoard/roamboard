import { discoverPhotos, type DiscoverPhoto } from "./discover-preview";

export type DiscoverDestination = {
    countryCode: string;
    slug: string;
    name: string;
    description: string;
    coverImage: DiscoverPhoto;
    previewBoardCount: number;
    layout: string;
};

// Country codes match BoardDestination.countryCode; counts are visual previews.
export const discoverDestinations: readonly DiscoverDestination[] = [
    {
        countryCode: "FR",
        slug: "france",
        name: "France",
        description:
            "Neighborhood cafés, coastal escapes, and cities worth exploring slowly.",
        coverImage: discoverPhotos.france,
        previewBoardCount: 217,
        layout: "md:col-start-1 md:col-span-2 md:row-start-1 md:row-span-3"
    },
    {
        countryCode: "ES",
        slug: "spain",
        name: "Spain",
        description:
            "Long lunches, sunlit streets, and evenings that stretch a little longer.",
        coverImage: discoverPhotos.spain,
        previewBoardCount: 126,
        layout: "md:col-start-3 md:col-span-5 md:row-start-1 md:row-span-2"
    },
    {
        countryCode: "ID",
        slug: "indonesia",
        name: "Indonesia",
        description:
            "Island journeys, lush landscapes, and time beside the sea.",
        coverImage: discoverPhotos.indonesia,
        previewBoardCount: 68,
        layout: "md:col-start-8 md:col-span-2 md:row-start-1 md:row-span-3"
    },
    {
        countryCode: "KR",
        slug: "south-korea",
        name: "South Korea",
        description:
            "Palace courtyards, lively neighborhoods, and flavors worth traveling for.",
        coverImage: discoverPhotos.korea,
        previewBoardCount: 89,
        layout: "md:col-start-10 md:col-span-3 md:row-start-1 md:row-span-3"
    },
    {
        countryCode: "BR",
        slug: "brazil",
        name: "Brazil",
        description:
            "Coastal cities, open-air adventures, and a rhythm all its own.",
        coverImage: discoverPhotos.brazil,
        previewBoardCount: 75,
        layout: "md:col-start-1 md:col-span-2 md:row-start-4 md:row-span-3"
    },
    {
        countryCode: "JP",
        slug: "japan",
        name: "Japan",
        description:
            "Quiet temple paths, vibrant cities, and small discoveries around every corner.",
        coverImage: discoverPhotos.japan,
        previewBoardCount: 104,
        layout: "md:col-start-3 md:col-span-2 md:row-start-3 md:row-span-3"
    },
    {
        countryCode: "MA",
        slug: "morocco",
        name: "Morocco",
        description:
            "Winding medina streets, mountain journeys, and warm rooftop evenings.",
        coverImage: discoverPhotos.morocco,
        previewBoardCount: 45,
        layout: "md:col-start-5 md:col-span-3 md:row-start-3 md:row-span-3"
    },
    {
        countryCode: "TH",
        slug: "thailand",
        name: "Thailand",
        description:
            "Temple visits, street-food stops, and island days with nowhere to rush.",
        coverImage: discoverPhotos.thailand,
        previewBoardCount: 153,
        layout: "md:col-start-8 md:col-span-5 md:row-start-4 md:row-span-2"
    }
];

if (
    new Set(discoverDestinations.map((destination) => destination.slug))
        .size !== discoverDestinations.length ||
    new Set(discoverDestinations.map((destination) => destination.countryCode))
        .size !== discoverDestinations.length ||
    discoverDestinations.some(
        (destination) => !/^[A-Z]{2}$/.test(destination.countryCode)
    )
) {
    throw new Error(
        "Destinations must have unique slugs and two-letter country codes."
    );
}

export function getDiscoverDestination(slug: string) {
    return discoverDestinations.find(
        (destination) => destination.slug === slug
    );
}

export function discoverDestinationHref(destination: DiscoverDestination) {
    return `/discover/destinations/${encodeURIComponent(destination.slug)}`;
}
