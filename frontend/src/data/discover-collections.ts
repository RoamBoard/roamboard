import { getBoardTag, isBoardTagId, type BoardTagId } from "./board-tags";
import { discoverPhotos, type DiscoverPhoto } from "./discover-preview";

export type DiscoverCollection = {
    id: string;
    slug: string;
    title: string;
    description: string;
    coverImage: DiscoverPhoto;
    tagIds: readonly BoardTagId[];
    lines?: readonly string[];
    layout?: string;
    moodRow?: number;
    large?: boolean;
    coverPosition?: string;
};

function moodCollection(
    slug: string,
    title: string,
    description: string,
    tagIds: readonly BoardTagId[],
    moodRow: number
): DiscoverCollection {
    const tag = getBoardTag(tagIds[0]);
    if (!tag) throw new Error("A mood collection needs a catalog cover tag.");
    return {
        id: slug,
        slug,
        title,
        description,
        tagIds,
        moodRow,
        coverImage: {
            src: tag.gridImage.url,
            alt: tag.gridImage.alt,
            sourceUrl: tag.gridImage.sourceUrl,
            photographer: tag.gridImage.photographer
        }
    };
}

// Shared by the Discover tiles and collection routes. Tag matches use OR semantics.
export const discoverCollections: readonly DiscoverCollection[] = [
    {
        id: "nightlife",
        slug: "nightlife",
        title: "Nightlife",
        lines: ["NIGHT-", "LIFE"],
        description: "Rooftops, hidden bars, and places worth staying out for.",
        coverImage: discoverPhotos.nightlife,
        tagIds: ["nightlife"],
        layout: "md:col-span-6 md:row-span-2",
        large: true
    },
    {
        id: "slow-mornings",
        slug: "slow-mornings",
        title: "Slow Mornings",
        lines: ["SLOW", "MORNINGS"],
        description:
            "Fresh pastries, neighborhood cafés, and taking the long way into the day.",
        coverImage: discoverPhotos.mornings,
        coverPosition: "center 65%",
        tagIds: ["slow-mornings", "cafe-hopping"],
        layout: "md:col-span-4"
    },
    {
        id: "by-the-water",
        slug: "by-the-water",
        title: "By the Water",
        lines: ["BY THE", "WATER"],
        description: "Sea air, slow walks, and places to sit for a while.",
        coverImage: discoverPhotos.water,
        tagIds: ["by-the-water", "beach-days", "island-hopping"],
        layout: "md:col-span-2"
    },
    {
        id: "food-and-more-food",
        slug: "food-and-more-food",
        title: "Food, and More Food",
        lines: ["FOOD, AND", "MORE FOOD"],
        description:
            "Local favorites, late dinners, and always room for dessert.",
        coverImage: discoverPhotos.food,
        tagIds: ["foodie", "street-food", "wine-and-dine"],
        layout: "md:col-span-3"
    },
    {
        id: "somewhere-quiet",
        slug: "somewhere-quiet",
        title: "Somewhere Quiet",
        lines: ["SOMEWHERE", "QUIET"],
        description:
            "Hidden corners, empty paths, and somewhere the noise doesn’t follow.",
        coverImage: discoverPhotos.quiet,
        tagIds: ["hidden-gems", "off-the-grid", "relax"],
        layout: "md:col-span-3"
    },
    moodCollection(
        "take-the-long-way",
        "Take the Long Way",
        "Scenic detours, open roads, and places worth stopping for.",
        ["scenic-routes", "road-trips"],
        0
    ),
    moodCollection(
        "no-fixed-plans",
        "No Fixed Plans",
        "Unexpected turns, hidden corners, and room for a little adventure.",
        ["adventure", "hidden-gems"],
        0
    ),
    moodCollection(
        "out-of-office",
        "Out of Office",
        "A change of scene and a weekend with nothing on the agenda.",
        ["weekend-escapes", "relax"],
        0
    ),
    moodCollection(
        "stay-out-late",
        "Stay Out Late",
        "Bright city nights and places that come alive after dark.",
        ["nightlife", "city-life"],
        1
    ),
    moodCollection(
        "follow-the-music",
        "Follow the Music",
        "Local culture, late-night gatherings, and evenings with a rhythm of their own.",
        ["nightlife", "culture"],
        1
    ),
    moodCollection(
        "one-more-drink",
        "One More Drink",
        "Unhurried dinners, lively bars, and an evening worth extending.",
        ["wine-and-dine", "nightlife"],
        1
    ),
    moodCollection(
        "coffee-first",
        "Coffee First",
        "Neighborhood cafés and mornings best started slowly.",
        ["cafe-hopping", "slow-mornings"],
        2
    ),
    moodCollection(
        "a-table-for-two",
        "A Table for Two",
        "Good food, candlelit evenings, and a little time together.",
        ["romantic", "wine-and-dine"],
        2
    ),
    moodCollection(
        "taste-the-streets",
        "Taste the Streets",
        "Market stalls, local favorites, and discoveries made one bite at a time.",
        ["street-food", "foodie"],
        2
    ),
    moodCollection(
        "follow-the-sea",
        "Follow the Sea",
        "Salt air, coastal paths, and days spent beside the water.",
        ["by-the-water", "beach-days"],
        3
    ),
    moodCollection(
        "chase-the-last-light",
        "Chase the Last Light",
        "Golden-hour walks, wide horizons, and somewhere to watch the sun go down.",
        ["sunsets", "scenic-routes"],
        3
    ),
    moodCollection(
        "island-time",
        "Island Time",
        "Slow island days and a new stretch of shoreline to explore.",
        ["island-hopping", "beach-days"],
        3
    ),
    moodCollection(
        "into-the-trees",
        "Into the Trees",
        "Forest paths, fresh air, and a night beneath the canopy.",
        ["nature", "camping"],
        4
    ),
    moodCollection(
        "above-the-clouds",
        "Above the Clouds",
        "Mountain trails, sweeping views, and a little perspective.",
        ["mountains", "hiking"],
        4
    ),
    moodCollection(
        "far-from-everything",
        "Far from Everything",
        "Quiet corners, open landscapes, and time away from the noise.",
        ["off-the-grid", "nature"],
        4
    )
];

export const discoverBentoCollections = discoverCollections.filter(
    (collection) => collection.moodRow === undefined
);
export const discoverMoodRows = Array.from({ length: 5 }, (_, row) =>
    discoverCollections.filter((collection) => collection.moodRow === row)
);

if (
    new Set(discoverCollections.map((collection) => collection.slug)).size !==
        discoverCollections.length ||
    new Set(discoverCollections.map((collection) => collection.id)).size !==
        discoverCollections.length ||
    discoverCollections.some(
        (collection) =>
            !collection.tagIds.length ||
            collection.tagIds.some((id) => !isBoardTagId(id))
    )
) {
    throw new Error(
        "Collections must have unique IDs/slugs and valid catalog tag IDs."
    );
}

export function getDiscoverCollection(slug: string) {
    return discoverCollections.find((collection) => collection.slug === slug);
}

export function discoverCollectionHref(collection: DiscoverCollection) {
    return `/discover/collections/${encodeURIComponent(collection.slug)}`;
}
