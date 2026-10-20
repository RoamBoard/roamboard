import { findCountry } from "@/lib/countries";

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
        countryCode: "FRA",
        slug: "france",
        name: "France",
        description: "Neighborhood cafés, coastal escapes, and cities worth exploring slowly.",
        coverImage: discoverPhotos.france,
        previewBoardCount: 217,
        layout: "@min-[68rem]/bento:col-start-1 @min-[68rem]/bento:col-span-2 @min-[68rem]/bento:row-start-1 @min-[68rem]/bento:row-span-3"
    },
    {
        countryCode: "ESP",
        slug: "spain",
        name: "Spain",
        description: "Long lunches, sunlit streets, and evenings that stretch a little longer.",
        coverImage: discoverPhotos.spain,
        previewBoardCount: 126,
        layout: "@min-[17rem]/bento:row-span-2 @min-[68rem]/bento:col-start-3 @min-[68rem]/bento:col-span-5 @min-[68rem]/bento:row-start-1 @min-[68rem]/bento:row-span-2"
    },
    {
        countryCode: "IDN",
        slug: "indonesia",
        name: "Indonesia",
        description: "Island journeys, lush landscapes, and time beside the sea.",
        coverImage: discoverPhotos.indonesia,
        previewBoardCount: 68,
        layout: "@min-[68rem]/bento:col-start-8 @min-[68rem]/bento:col-span-2 @min-[68rem]/bento:row-start-1 @min-[68rem]/bento:row-span-3"
    },
    {
        countryCode: "KOR",
        slug: "south-korea",
        name: "South Korea",
        description: "Palace courtyards, lively neighborhoods, and flavors worth traveling for.",
        coverImage: discoverPhotos.korea,
        previewBoardCount: 89,
        layout: "@min-[68rem]/bento:col-start-10 @min-[68rem]/bento:col-span-3 @min-[68rem]/bento:row-start-1 @min-[68rem]/bento:row-span-3"
    },
    {
        countryCode: "BRA",
        slug: "brazil",
        name: "Brazil",
        description: "Coastal cities, open-air adventures, and a rhythm all its own.",
        coverImage: discoverPhotos.brazil,
        previewBoardCount: 75,
        layout: "@min-[68rem]/bento:col-start-1 @min-[68rem]/bento:col-span-2 @min-[68rem]/bento:row-start-4 @min-[68rem]/bento:row-span-3"
    },
    {
        countryCode: "JPN",
        slug: "japan",
        name: "Japan",
        description: "Quiet temple paths, vibrant cities, and small discoveries around every corner.",
        coverImage: discoverPhotos.japan,
        previewBoardCount: 104,
        layout: "@min-[68rem]/bento:col-start-3 @min-[68rem]/bento:col-span-2 @min-[68rem]/bento:row-start-3 @min-[68rem]/bento:row-span-3"
    },
    {
        countryCode: "MAR",
        slug: "morocco",
        name: "Morocco",
        description: "Winding medina streets, mountain journeys, and warm rooftop evenings.",
        coverImage: discoverPhotos.morocco,
        previewBoardCount: 45,
        layout: "@min-[68rem]/bento:col-start-5 @min-[68rem]/bento:col-span-3 @min-[68rem]/bento:row-start-3 @min-[68rem]/bento:row-span-3"
    },
    {
        countryCode: "THA",
        slug: "thailand",
        name: "Thailand",
        description: "Temple visits, street-food stops, and island days with nowhere to rush.",
        coverImage: discoverPhotos.thailand,
        previewBoardCount: 153,
        layout: "@min-[17rem]/bento:col-span-2 @min-[68rem]/bento:col-start-8 @min-[68rem]/bento:col-span-5 @min-[68rem]/bento:row-start-4 @min-[68rem]/bento:row-span-2"
    }
];

if (
    new Set(discoverDestinations.map((destination) => destination.slug)).size !== discoverDestinations.length ||
    new Set(discoverDestinations.map((destination) => destination.countryCode)).size !== discoverDestinations.length ||
    discoverDestinations.some((destination) => findCountry(destination.countryCode)?.code !== destination.countryCode)
) {
    throw new Error("Destinations must have unique slugs and valid three-letter country codes.");
}

export function getDiscoverDestination(slug: string) {
    return discoverDestinations.find((destination) => destination.slug === slug);
}

export function discoverDestinationHref(destination: DiscoverDestination) {
    return `/discover/destinations/${encodeURIComponent(destination.slug)}`;
}
