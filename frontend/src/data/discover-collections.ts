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
        layout: "@min-[68rem]/bento:col-span-6 @min-[68rem]/bento:row-span-2",
        large: true
    },
    {
        id: "slow-mornings",
        slug: "slow-mornings",
        title: "Slow Mornings",
        lines: ["SLOW", "MORNINGS"],
        description: "Fresh pastries, neighborhood cafés, and taking the long way into the day.",
        coverImage: discoverPhotos.mornings,
        coverPosition: "center 65%",
        tagIds: ["slow-mornings", "cafe-hopping"],
        layout: "@min-[68rem]/bento:col-span-4"
    },
    {
        id: "by-the-water",
        slug: "by-the-water",
        title: "By the Water",
        lines: ["BY THE", "WATER"],
        description: "Sea air, slow walks, and places to sit for a while.",
        coverImage: discoverPhotos.water,
        tagIds: ["by-the-water", "beach-days", "island-hopping"],
        layout: "@min-[68rem]/bento:col-span-2"
    },
    {
        id: "food-and-more-food",
        slug: "food-and-more-food",
        title: "Food, and More Food",
        lines: ["FOOD, AND", "MORE FOOD"],
        description: "Local favorites, late dinners, and always room for dessert.",
        coverImage: discoverPhotos.food,
        tagIds: ["foodie", "street-food", "wine-and-dine"],
        layout: "@min-[68rem]/bento:col-span-3"
    },
    {
        id: "somewhere-quiet",
        slug: "somewhere-quiet",
        title: "Somewhere Quiet",
        lines: ["SOMEWHERE", "QUIET"],
        description: "Hidden corners, empty paths, and somewhere the noise doesn’t follow.",
        coverImage: discoverPhotos.quiet,
        tagIds: ["hidden-gems", "off-the-grid", "relax"],
        layout: "@min-[68rem]/bento:col-span-3"
    },
    moodCollection(
        "take-the-long-way",
        "Road Trip Stops",
        "Places worth pulling over for on a long drive.",
        ["scenic-routes", "road-trips"],
        0
    ),
    moodCollection(
        "no-fixed-plans",
        "An Unplanned Weekend",
        "Ideas for a weekend you haven't filled in yet.",
        ["adventure", "hidden-gems"],
        0
    ),
    moodCollection(
        "out-of-office",
        "A Few Days Away",
        "Somewhere to go when you have a couple of days off.",
        ["weekend-escapes", "relax"],
        0
    ),
    moodCollection(
        "stay-out-late",
        "After Dark",
        "Bars and neighborhoods that stay busy late.",
        ["nightlife", "city-life"],
        1
    ),
    moodCollection(
        "follow-the-music",
        "Live Music",
        "Places to catch a show while you're in town.",
        ["nightlife", "culture"],
        1
    ),
    moodCollection(
        "one-more-drink",
        "Drinks After Dinner",
        "A bar to head to when dinner is over.",
        ["wine-and-dine", "nightlife"],
        1
    ),
    moodCollection(
        "coffee-first",
        "Coffee and a Walk",
        "Coffee shops and nearby streets to wander.",
        ["cafe-hopping", "slow-mornings"],
        2
    ),
    moodCollection(
        "a-table-for-two",
        "Dinner for Two",
        "Restaurants for a long dinner together.",
        ["romantic", "wine-and-dine"],
        2
    ),
    moodCollection(
        "taste-the-streets",
        "Street Food",
        "Markets, stalls, and good things to eat on the go.",
        ["street-food", "foodie"],
        2
    ),
    moodCollection(
        "follow-the-sea",
        "Coastal Walks",
        "Beaches, harbors, and paths beside the water.",
        ["by-the-water", "beach-days"],
        3
    ),
    moodCollection(
        "chase-the-last-light",
        "Sunset Spots",
        "Places to stop and watch the sun go down.",
        ["sunsets", "scenic-routes"],
        3
    ),
    moodCollection(
        "island-time",
        "Island Hopping",
        "Island towns, beaches, and time on the water.",
        ["island-hopping", "beach-days"],
        3
    ),
    moodCollection(
        "into-the-trees",
        "Forest Trails",
        "Wooded walks and places to camp nearby.",
        ["nature", "camping"],
        4
    ),
    moodCollection(
        "above-the-clouds",
        "Mountain Hikes",
        "Trails, viewpoints, and the climb to get there.",
        ["mountains", "hiking"],
        4
    ),
    moodCollection(
        "far-from-everything",
        "Off-Grid Stays",
        "Cabins and quiet places away from the crowds.",
        ["off-the-grid", "nature"],
        4
    )
];

export const discoverBentoCollections = discoverCollections.filter((collection) => collection.moodRow === undefined);

if (
    new Set(discoverCollections.map((collection) => collection.slug)).size !== discoverCollections.length ||
    new Set(discoverCollections.map((collection) => collection.id)).size !== discoverCollections.length ||
    discoverCollections.some(
        (collection) => !collection.tagIds.length || collection.tagIds.some((id) => !isBoardTagId(id))
    )
) {
    throw new Error("Collections must have unique IDs/slugs and valid catalog tag IDs.");
}

export function getDiscoverCollection(slug: string) {
    return discoverCollections.find((collection) => collection.slug === slug);
}

export function discoverCollectionHref(collection: DiscoverCollection) {
    return `/discover/collections/${encodeURIComponent(collection.slug)}`;
}
