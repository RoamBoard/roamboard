import type { BoardActivity, BoardImage } from "@/types/board";
import type { PublishedBoardData } from "@/types/published-board";

// Build photo objects from files in public/images/boards.
function photo(name: string, alt: string): BoardImage {
    return {
        id: `preview-photo-${name}`,
        url: `/images/boards/${name}.jpg`,
        alt,
        source: "application"
    };
}

// Reuse these photo objects across the sample board.
const photos = {
    cover: photo(
        "cover",
        "Stone steps leading to a shrine through green trees"
    ),
    street: photo(
        "night-street",
        "A Tokyo street filled with people and neon signs"
    ),
    ramen: photo("ramen", "A bowl of ramen with noodles and toppings"),
    // This fictional author fills the profile section at the bottom of the page.
    author: photo("author", "A portrait outdoors among the trees"),
    temple: photo(
        "temple",
        "People exploring the grounds of Senso-ji in Asakusa"
    ),
    cafe: photo("cafe", "A Tokyo cafe with wooden tables and warm light"),
    neighbourhood: photo(
        "neighbourhood",
        "A cyclist passing a Tokyo coffee shop"
    )
};

// These descriptions, locations, and author statistics are fictional sample
// content. Photos are temporary preview assets, not the exact Figma photos.
const activities: BoardActivity[] = [
    {
        id: "tokyo-shibuya-sky",
        type: "activity",
        dayNumber: 1,
        title: "Shibuya Sky",
        time: "09:00",
        description:
            "Start above the city, then find your way into it. Take a slow look across the rooftops before heading down to the crossing. Leave a little room in the plan for wherever the morning takes you.",
        location: {
            id: "preview-shibuya",
            source: "manual",
            name: "Shibuya",
            city: "Tokyo",
            countryCode: "JP",
            latitude: 35.658,
            longitude: 139.702
        },
        images: [photos.street, photos.temple]
    },
    {
        id: "tokyo-chatei-hatou",
        type: "activity",
        dayNumber: 1,
        title: "Chatei Hatou",
        time: "11:30",
        description:
            "Take a seat, order a coffee, and slow down. This is the part of the day for a quiet conversation and a slice of cake before stepping back into the busy streets of Shibuya.",
        location: {
            id: "preview-chatei",
            source: "manual",
            name: "Chatei Hatou",
            city: "Tokyo",
            countryCode: "JP",
            latitude: 35.6601,
            longitude: 139.7018
        },
        images: [photos.cafe]
    },
    {
        id: "tokyo-daikanyama",
        type: "activity",
        dayNumber: 1,
        title: "Daikanyama T-Site",
        time: "14:00",
        description:
            "Trade the rush for books, little shops, and a long afternoon walk. Browse without a list, take the side streets, and stop whenever a window or a good coffee catches your eye.",
        location: {
            id: "preview-daikanyama",
            source: "manual",
            name: "Daikanyama",
            city: "Tokyo",
            countryCode: "JP",
            latitude: 35.6484,
            longitude: 139.7032
        },
        images: [photos.neighbourhood]
    },
    {
        id: "tokyo-ebisu",
        type: "activity",
        dayNumber: 1,
        title: "Ebisu Yokocho",
        time: "17:00",
        description:
            "Follow the warm lights into an evening of small plates and conversation. Pick somewhere that looks welcoming, order a little at a time, and let dinner stretch into the night.",
        location: {
            id: "preview-ebisu",
            source: "manual",
            name: "Ebisu",
            city: "Tokyo",
            countryCode: "JP",
            latitude: 35.6474,
            longitude: 139.7101
        },
        images: [photos.street, photos.neighbourhood]
    },
    {
        id: "tokyo-ramen",
        type: "activity",
        dayNumber: 1,
        title: "Late night ramen",
        time: "20:00",
        description:
            "Save room for one last bowl. Find a little counter on the way home, settle in, and finish the day with something warm. No rush, just noodles and the city outside.",
        images: [photos.ramen]
    },
    {
        id: "tokyo-sensoji",
        type: "activity",
        dayNumber: 2,
        title: "Senso-ji & Asakusa",
        time: "08:30",
        description:
            "Begin with a quiet wander around Asakusa. Walk through the temple grounds, explore the surrounding lanes, and leave time for a snack and a few unexpected turns.",
        location: {
            id: "preview-asakusa",
            source: "manual",
            name: "Senso-ji, Asakusa",
            city: "Tokyo",
            countryCode: "JP",
            latitude: 35.7148,
            longitude: 139.7967
        },
        images: [photos.temple, photos.cover]
    },
    {
        id: "tokyo-kappabashi",
        type: "activity",
        dayNumber: 2,
        title: "Kappabashi Kitchen Street",
        time: "11:00",
        description:
            "Browse shelves of bowls, kitchen tools, and things you did not know you wanted. This is a lovely place to find one small souvenir that will remind you of the trip.",
        location: {
            id: "preview-kappabashi",
            source: "manual",
            name: "Kappabashi",
            city: "Tokyo",
            countryCode: "JP",
            latitude: 35.7124,
            longitude: 139.7882
        },
        images: [photos.neighbourhood]
    },
    {
        id: "tokyo-ameyoko",
        type: "activity",
        dayNumber: 2,
        title: "Ameyoko, Ueno",
        time: "14:30",
        description:
            "Walk through the market streets and follow whatever looks good. Share a few bites, peek into the little shops, and enjoy an afternoon with nowhere urgent to be.",
        location: {
            id: "preview-ueno",
            source: "manual",
            name: "Ameyoko, Ueno",
            city: "Tokyo",
            countryCode: "JP",
            latitude: 35.7099,
            longitude: 139.7745
        },
        images: [photos.street]
    },
    {
        id: "tokyo-akihabara",
        type: "activity",
        dayNumber: 2,
        title: "Akihabara",
        // Deliberately untimed: numbered days do not require a date or time.
        description:
            "End the day among bright signs, arcades, and shop windows. Explore at your own pace, take a few photos, and let the lights guide you through one final Tokyo evening.",
        location: {
            id: "preview-akihabara",
            source: "manual",
            name: "Akihabara",
            city: "Tokyo",
            countryCode: "JP",
            latitude: 35.6984,
            longitude: 139.773
        },
        images: [photos.street, photos.temple]
    }
];

// Sample data for /boards/lost-in-tokyo while the board API is being built.
export const mockPublishedBoard: PublishedBoardData = {
    board: {
        id: "lost-in-tokyo",
        ownerId: "preview-author-maya",
        title: "Lost in Tokyo",
        description:
            "Neon streets, tiny bars, late-night ramen, and absolutely no idea which train exit to take. This board is for wandering first and figuring things out somewhere along the way — from crowded crossings and hidden alleyways to quiet shrines, tiny cafes, record stores, rooftops, and neighborhoods that somehow keep you out much later than planned. Expect long days, even longer walks, spontaneous detours, vending-machine stops, way too many convenience-store snacks, and at least a few meals you'll still be thinking about when you get home. It's less about ticking off every famous sight and more about getting a little lost, following whatever looks interesting, and letting Tokyo do what it does best: surprise you around every corner.",
        visibility: "public",
        isCompleted: false,
        // The viewer shows up to three tags from this list.
        tags: ["Nature", "Romantic", "Hidden Gems"],
        destinations: [
            { country: "Japan", countryCode: "JP", cities: ["Tokyo"] }
        ],
        durationDays: 2,
        // Custom headings are matched to day numbers, starting at 1.
        dayTitles: {
            1: "Shibuya Sky → late night ramen",
            2: "Senso-ji & Asakusa → Akihabara"
        },
        coverImage: photos.cover,
        // dayNumber on each activity decides which day it appears under.
        items: activities,
        createdAt: "2026-10-01T12:00:00Z",
        updatedAt: "2026-10-01T12:00:00Z"
    },
    author: {
        id: "preview-author-maya",
        name: "Maya",
        photo: photos.author,
        bio: "I'm happiest somewhere between a crowded market, a tiny cafe, and a street I definitely wasn't meant to turn down. I travel for the food, the people, the architecture, and those unplanned little moments that somehow become the whole reason you remember a place.",
        countriesVisited: 61,
        boardsCreated: 47
    },
    highlights: ["Neighborhoods", "Hidden bars", "Ramen"]
};
