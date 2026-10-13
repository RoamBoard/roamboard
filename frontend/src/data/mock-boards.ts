//Ai made mock data for development and testing. Not saved Boards or authenticated user data.
import type { Board } from "@/types/board";

// Fictional development data, not saved Boards or authenticated user data.
export const mockOwnerId = "mock-user-1";

// Image URLs use existing local SVG placeholders. "upload" simulates the
// source of a future user photo; no upload has taken place.
export const mockBoards: Board[] = [
    // A new Board can have no destination, dates, cover, or content yet.
    {
        id: "mock-board-empty",
        ownerId: mockOwnerId,
        title: "My next trip",
        description: "",
        visibility: "private",
        isCompleted: false,
        tags: [],
        destinations: [],
        items: [],
        createdAt: "2026-09-30T08:00:00Z",
        updatedAt: "2026-09-30T08:00:00Z"
    },
    // A dated itinerary with activities and a standalone location to consider.
    {
        id: "mock-board-tokyo",
        ownerId: mockOwnerId,
        title: "A weekend in Tokyo",
        description: "Two days for food, walks, and time to explore Asakusa.",
        visibility: "public",
        isCompleted: false,
        tags: ["foodie", "hiking"],
        destinations: [
            { country: "Japan", countryCode: "JP", cities: ["Tokyo"] }
        ],
        startDate: "2026-11-14",
        endDate: "2026-11-15",
        durationDays: 2,
        budget: "medium",
        travelStyle: "couple",
        coverImage: {
            id: "mock-image-tokyo-cover",
            url: "/globe.svg",
            alt: "Globe icon used as a placeholder for the Tokyo cover",
            source: "application"
        },
        items: [
            {
                id: "mock-item-tokyo-temple",
                type: "activity",
                title: "Explore Senso-ji",
                description: "Walk around the temple grounds before lunch.",
                location: {
                    id: "mock-location-senso-ji",
                    source: "google",
                    name: "Senso-ji",
                    address: "Asakusa, Taito City, Tokyo",
                    latitude: 35.7148,
                    longitude: 139.7967,
                    countryCode: "JP",
                    city: "Tokyo",
                    // Simulated selection only. This placeholder is not a real Google place ID.
                    googlePlaceId: "mock-google-place-senso-ji",
                    googleMapsUrl:
                        "https://www.google.com/maps/search/?api=1&query=35.7148%2C139.7967"
                },
                date: "2026-11-14",
                time: "10:00",
                images: []
            },
            {
                id: "mock-item-tokyo-note",
                type: "text",
                text: "Leave the afternoon open for food stops and a walk by the river."
            },
            {
                id: "mock-item-tokyo-park",
                type: "location",
                location: {
                    id: "mock-location-ueno-park",
                    source: "manual",
                    name: "Ueno Park",
                    latitude: 35.7146,
                    longitude: 139.7745,
                    countryCode: "JP",
                    city: "Tokyo"
                },
                notes: "Keep this as an option for a quiet afternoon walk.",
                images: []
            },
            {
                id: "mock-item-tokyo-breakfast",
                type: "activity",
                title: "Find a breakfast cafe",
                description: "Choose somewhere near where we are staying.",
                date: "2026-11-15",
                images: []
            }
        ],
        createdAt: "2026-09-20T15:00:00Z",
        updatedAt: "2026-09-28T18:30:00Z"
    },
    // A completed trip with journal text and simulated uploaded photos.
    {
        id: "mock-board-copenhagen",
        ownerId: mockOwnerId,
        title: "Copenhagen with friends",
        description: "A day of walking by the water and stopping for coffee.",
        visibility: "friends",
        isCompleted: true,
        tags: ["foodie", "hiking", "photography"],
        destinations: [
            { country: "Denmark", countryCode: "DK", cities: ["Copenhagen"] }
        ],
        startDate: "2026-08-22",
        endDate: "2026-08-22",
        durationDays: 1,
        budget: "low",
        travelStyle: "friends",
        coverImage: {
            id: "mock-image-copenhagen-cover",
            url: "/globe.svg",
            alt: "Globe icon used as a placeholder for a Copenhagen trip photo",
            source: "upload"
        },
        items: [
            {
                id: "mock-item-copenhagen-harbour",
                type: "activity",
                title: "Morning at Nyhavn",
                description:
                    "We walked along the harbour and took photos of the boats.",
                location: {
                    id: "mock-location-nyhavn",
                    source: "manual",
                    name: "Nyhavn",
                    latitude: 55.6798,
                    longitude: 12.5904,
                    countryCode: "DK",
                    city: "Copenhagen"
                },
                date: "2026-08-22",
                time: "09:30",
                images: [
                    {
                        id: "mock-image-copenhagen-harbour",
                        url: "/window.svg",
                        alt: "Window icon used as a placeholder for a harbour photo",
                        source: "upload"
                    }
                ]
            },
            {
                id: "mock-item-copenhagen-journal",
                type: "text",
                text: "We spent longer by the water than we expected. Next time I would leave another day for the rest of the city."
            },
            {
                id: "mock-item-copenhagen-photo",
                type: "image",
                image: {
                    id: "mock-image-copenhagen-coffee",
                    url: "/window.svg",
                    alt: "Window icon used as a placeholder for a coffee stop photo",
                    source: "upload"
                }
            }
        ],
        createdAt: "2026-08-15T12:00:00Z",
        updatedAt: "2026-08-23T17:00:00Z"
    },
    // An undated trip can still have a duration and several countries.
    // Italy deliberately has no cities selected yet.
    {
        id: "mock-board-europe",
        ownerId: mockOwnerId,
        title: "Two weeks by train",
        description:
            "Start in France, continue through Switzerland, then visit Italy.",
        visibility: "private",
        isCompleted: false,
        tags: ["nature", "culture"],
        destinations: [
            { country: "France", countryCode: "FR", cities: ["Paris", "Lyon"] },
            { country: "Switzerland", countryCode: "CH", cities: ["Zurich"] },
            { country: "Italy", countryCode: "IT" }
        ],
        durationDays: 14,
        budget: "high",
        travelStyle: "solo",
        items: [
            {
                id: "mock-item-europe-note",
                type: "text",
                text: "Decide on dates and the Italian stops before booking trains."
            },
            {
                id: "mock-item-europe-museum",
                type: "activity",
                title: "Visit a museum in Paris",
                description: "Choose the museum once the dates are set.",
                images: []
            },
            {
                id: "mock-item-europe-lake",
                type: "location",
                location: {
                    id: "mock-location-burkliplatz",
                    source: "manual",
                    name: "Burkliplatz, Zurich",
                    latitude: 47.3661,
                    longitude: 8.5413,
                    countryCode: "CH",
                    city: "Zurich"
                },
                notes: "A possible stop by the lake. Choose a day once the trains are booked.",
                images: [
                    {
                        id: "mock-image-zurich-lake",
                        url: "/globe.svg",
                        alt: "Globe icon used as a placeholder for a lake photo",
                        source: "upload"
                    }
                ]
            }
        ],
        createdAt: "2026-09-25T10:00:00Z",
        updatedAt: "2026-09-29T16:45:00Z"
    }
];
