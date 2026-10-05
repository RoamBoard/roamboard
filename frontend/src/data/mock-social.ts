import type { UserProfile, UserSettings } from "@/types/social";
import { calculateTravelerTier } from "@/utils/tier";

export const mockRowanProfile: UserProfile = {
    id: "user-rowan-mercer",
    name: "ROWAN",
    handle: "@rowan.mercer",
    whatsapp: "07012545678",
    avatarUrl:
        "https://images.unsplash.com/photo-1769786186317-272d062fcf93?auto=format&fit=crop&w=400&q=80",
    location: "San Fransisco, USA",
    headline: "Chasing places, collecting stories.",
    bio: 'Usually somewhere between "I made an itinerary" and "we\'ll figure it out when we get there." I travel for the food, the views, the people, and the completely unnecessary side quests that somehow become the best part of the trip.',
    tier: "PLATINUM TRAVELER",
    stats: {
        countriesVisited: 32,
        boardsCreated: 12,
        friendsMade: 48,
        placesSaved: 127,
        boardsSaved: 68
    },
    facts: [
        "First solo trip at nineteen, backpacking through the Balkans by train.",
        "Lost my passport in Hanoi, found it 48 hours later behind a noodle shop.",
        "Will always wake up for sunrise over mountains; will never wake up early for a museum.",
        "Has a habit of buying local vinyl records in every city, despite rarely owning a turntable."
    ],
    details: {
        location: "San Francisco, USA",
        languages: ["English", "Italian", "German"],
        overlappingDestinations: 14,
        interests: ["Photography", "Food", "Hiking"]
    },
    inspiredBoards: [
        {
            id: "board-tokyo",
            titleLines: ["Lost in", "Tokyo"],
            author: "by Noah Fischer",
            duration: "4 days",
            countryCode: "JPN",
            quote: "Neon streets, tiny bars, late-night ramen and absolutely no idea which train exit to take.",
            tags: ["Neighborhoods", "Hidden bars", "Ramen"],
            highlights: [
                "Shibuya Crossing",
                "Senso-ji",
                "Shimokitazawa",
                "Meiji Shrine Tsukiji",
                "Outer Market",
                "Golden Gai"
            ],
            savedCount: "Saved by 1,284 travelers",
            images: [
                {
                    url: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=400&q=80",
                    alt: "Tokyo red tower"
                },
                {
                    url: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=400&q=80",
                    alt: "Tokyo neon alley"
                },
                {
                    url: "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=400&q=80",
                    alt: "Tokyo lantern street"
                },
                {
                    url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80",
                    alt: "Tokyo alley bars"
                },
                {
                    url: "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=400&q=80",
                    alt: "Shinjuku night skyline"
                },
                {
                    url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=400&q=80",
                    alt: "Senso-ji pagoda"
                }
            ]
        },
        {
            id: "board-paris",
            titleLines: ["Paris,", "obviously"],
            author: "by Chloe Martin",
            duration: "3 days",
            countryCode: "FRA",
            quote: "Croissants for breakfast, wine by sunset and somehow another hour spent wandering streets we definitely didn't mean to take.",
            tags: ["Café hopping", "Scenic lunches", "Late-night walks"],
            highlights: [
                "Montmartre",
                "Le Marais",
                "Palais Royal",
                "Canal Saint-Martin",
                "Jardin du Luxembourg",
                "Saint-Germain-des-Prés"
            ],
            savedCount: "Saved by 1,476 travelers",
            images: [
                {
                    url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80",
                    alt: "Eiffel tower and classic Parisian avenue"
                },
                {
                    url: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=400&q=80",
                    alt: "Pont Alexandre III at sunset"
                },
                {
                    url: "https://images.unsplash.com/photo-1520939817895-060bdef4dc1b?auto=format&fit=crop&w=400&q=80",
                    alt: "Parisian sidewalk café"
                },
                {
                    url: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=400&q=80",
                    alt: "Eiffel Tower viewed from Seine"
                },
                {
                    url: "https://images.unsplash.com/photo-1549144511-f099e773c147?auto=format&fit=crop&w=400&q=80",
                    alt: "Louvre glass pyramid at twilight"
                },
                {
                    url: "https://images.unsplash.com/photo-1509299349698-dd22323b5963?auto=format&fit=crop&w=400&q=80",
                    alt: "Arc de Triomphe facade"
                }
            ]
        },
        {
            id: "board-bangkok",
            titleLines: ["Bangkok before", "breakfast"],
            author: "by Mateo Reyes",
            duration: "5 days",
            countryCode: "THA",
            quote: "Street food at sunrise, temples before the heat and somehow already three iced coffees deep before most of the city has properly woken up.",
            tags: ["Night markets", "Temple hopping", "Street food"],
            highlights: [
                "Wat Arun",
                "Chinatown",
                "Chatuchak Market",
                "Talat Noi",
                "Wat Pho",
                "Yaowarat Road"
            ],
            savedCount: "Saved by 1,932 travelers",
            images: [
                {
                    url: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=400&q=80",
                    alt: "Wat Arun temple at dawn"
                },
                {
                    url: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=400&q=80",
                    alt: "Bangkok tuk-tuk in Chinatown"
                },
                {
                    url: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=400&q=80",
                    alt: "Longtail wooden boat on river"
                },
                {
                    url: "https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=400&q=80",
                    alt: "Chao Phraya sunset over temples"
                },
                {
                    url: "https://images.unsplash.com/photo-1512553353614-82a7370096dc?auto=format&fit=crop&w=400&q=80",
                    alt: "Bangkok street night market"
                },
                {
                    url: "https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?auto=format&fit=crop&w=400&q=80",
                    alt: "Bangkok morning golden sunlight"
                }
            ]
        }
    ],
    myBoards: [
        {
            id: "my-board-tokyo",
            titleLines: ["Lost in", "Tokyo"],
            author: "by Noah Fischer",
            duration: "4 days",
            countryCode: "JPN",
            quote: "Neon streets, tiny bars, late-night ramen and absolutely no idea which train exit to take.",
            tags: ["Neighborhoods", "Hidden bars", "Ramen"],
            highlights: [
                "Shibuya Crossing",
                "Senso-ji",
                "Shimokitazawa",
                "Meiji Shrine Tsukiji",
                "Outer Market",
                "Golden Gai"
            ],
            savedCount: "Saved by 1,284 travelers",
            images: [
                {
                    url: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=400&q=80",
                    alt: "Tokyo red tower"
                },
                {
                    url: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=400&q=80",
                    alt: "Tokyo neon alley"
                },
                {
                    url: "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=400&q=80",
                    alt: "Tokyo lantern street"
                },
                {
                    url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80",
                    alt: "Tokyo alley bars"
                },
                {
                    url: "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=400&q=80",
                    alt: "Shinjuku night skyline"
                },
                {
                    url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=400&q=80",
                    alt: "Senso-ji pagoda"
                }
            ]
        },
        {
            id: "my-board-paris",
            titleLines: ["Paris,", "obviously"],
            author: "by Chloe Martin",
            duration: "3 days",
            countryCode: "FRA",
            quote: "Croissants for breakfast, wine by sunset and somehow another hour spent wandering streets we definitely didn't mean to take.",
            tags: ["Café hopping", "Scenic lunches", "Late-night walks"],
            highlights: [
                "Montmartre",
                "Le Marais",
                "Palais Royal",
                "Canal Saint-Martin",
                "Jardin du Luxembourg",
                "Saint-Germain-des-Prés"
            ],
            savedCount: "Saved by 1,476 travelers",
            images: [
                {
                    url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80",
                    alt: "Eiffel tower and classic Parisian avenue"
                },
                {
                    url: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=400&q=80",
                    alt: "Pont Alexandre III at sunset"
                },
                {
                    url: "https://images.unsplash.com/photo-1520939817895-060bdef4dc1b?auto=format&fit=crop&w=400&q=80",
                    alt: "Parisian sidewalk café"
                },
                {
                    url: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=400&q=80",
                    alt: "Eiffel Tower viewed from Seine"
                },
                {
                    url: "https://images.unsplash.com/photo-1549144511-f099e773c147?auto=format&fit=crop&w=400&q=80",
                    alt: "Louvre glass pyramid at twilight"
                },
                {
                    url: "https://images.unsplash.com/photo-1509299349698-dd22323b5963?auto=format&fit=crop&w=400&q=80",
                    alt: "Arc de Triomphe facade"
                }
            ]
        },
        {
            id: "my-board-bangkok",
            titleLines: ["Bangkok before", "breakfast"],
            author: "by Mateo Reyes",
            duration: "5 days",
            countryCode: "THA",
            quote: "Street food at sunrise, temples before the heat and somehow already three iced coffees deep before most of the city has properly woken up.",
            tags: ["Night markets", "Temple hopping", "Street food"],
            highlights: [
                "Wat Arun",
                "Chinatown",
                "Chatuchak Market",
                "Talat Noi",
                "Wat Pho",
                "Yaowarat Road"
            ],
            savedCount: "Saved by 1,932 travelers",
            images: [
                {
                    url: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=400&q=80",
                    alt: "Wat Arun temple at dawn"
                },
                {
                    url: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=400&q=80",
                    alt: "Bangkok tuk-tuk in Chinatown"
                },
                {
                    url: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=400&q=80",
                    alt: "Longtail wooden boat on river"
                },
                {
                    url: "https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=400&q=80",
                    alt: "Chao Phraya sunset over temples"
                },
                {
                    url: "https://images.unsplash.com/photo-1512553353614-82a7370096dc?auto=format&fit=crop&w=400&q=80",
                    alt: "Bangkok street night market"
                },
                {
                    url: "https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?auto=format&fit=crop&w=400&q=80",
                    alt: "Bangkok morning golden sunlight"
                }
            ]
        }
    ],
    mapStats: {
        countriesVisited: 32,
        citiesExplored: 63,
        continentsCovered: 4,
        photosTaken: 18420
    },
    mapPins: [
        {
            id: "pin-sf",
            name: "San Francisco",
            country: "USA",
            latitude: 37.77,
            longitude: -122.42,
            status: "visited"
        },
        {
            id: "pin-nyc",
            name: "New York",
            country: "USA",
            latitude: 40.71,
            longitude: -74.0,
            status: "visited"
        },
        {
            id: "pin-vancouver",
            name: "Vancouver",
            country: "Canada",
            latitude: 49.28,
            longitude: -123.12,
            status: "visited"
        },
        {
            id: "pin-london",
            name: "London",
            country: "UK",
            latitude: 51.5,
            longitude: -0.12,
            status: "visited"
        },
        {
            id: "pin-paris",
            name: "Paris",
            country: "France",
            latitude: 48.85,
            longitude: 2.35,
            status: "visited"
        },
        {
            id: "pin-berlin",
            name: "Berlin",
            country: "Germany",
            latitude: 52.52,
            longitude: 13.4,
            status: "visited"
        },
        {
            id: "pin-rome",
            name: "Rome",
            country: "Italy",
            latitude: 41.9,
            longitude: 12.49,
            status: "visited"
        },
        {
            id: "pin-cairo",
            name: "Cairo",
            country: "Egypt",
            latitude: 30.04,
            longitude: 31.23,
            status: "visited"
        },
        {
            id: "pin-capetown",
            name: "Cape Town",
            country: "South Africa",
            latitude: -33.92,
            longitude: 18.42,
            status: "visited"
        },
        {
            id: "pin-bangkok",
            name: "Bangkok",
            country: "Thailand",
            latitude: 13.75,
            longitude: 100.5,
            status: "visited"
        },
        {
            id: "pin-tokyo",
            name: "Tokyo",
            country: "Japan",
            latitude: 35.68,
            longitude: 139.76,
            status: "visited"
        },
        {
            id: "pin-sydney",
            name: "Sydney",
            country: "Australia",
            latitude: -33.87,
            longitude: 151.21,
            status: "visited"
        }
    ],
    milestones: [
        {
            id: "m-1",
            label: "most visited",
            value: "Tokyo",
            subLabel: "3 visits",
            images: [
                {
                    url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=300&q=80",
                    alt: "Senso-ji pagoda close-up"
                },
                {
                    url: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=300&q=80",
                    alt: "Tokyo vibrant neon alley"
                },
                {
                    url: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=300&q=80",
                    alt: "Tokyo night street"
                }
            ]
        },
        {
            id: "m-2",
            label: "longest trip",
            value: "11 days",
            subLabel: "Greece, 2024",
            images: [
                {
                    url: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=300&q=80",
                    alt: "Santorini cliffside white village"
                },
                {
                    url: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=300&q=80",
                    alt: "Greek seaside dining with white chairs"
                },
                {
                    url: "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=300&q=80",
                    alt: "Ancient Greek temple columns"
                }
            ]
        },
        {
            id: "m-3",
            label: "biggest travel year",
            value: "2023",
            subLabel: "12 places",
            images: [
                {
                    url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=300&q=80",
                    alt: "Desert canyon rock formations"
                },
                {
                    url: "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=300&q=80",
                    alt: "Manhattan avenue canyon perspective"
                },
                {
                    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=300&q=80",
                    alt: "Green mountain ridge and valley"
                }
            ]
        },
        {
            id: "m-4",
            label: "most visited region",
            value: "Southern Europe",
            subLabel: "8 places",
            images: [
                {
                    url: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=300&q=80",
                    alt: "Cinque Terre colorful coastal village"
                },
                {
                    url: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=300&q=80",
                    alt: "Amalfi beach umbrellas in turquoise water"
                },
                {
                    url: "https://images.unsplash.com/photo-1520175480921-4edfa2983e0f?auto=format&fit=crop&w=300&q=80",
                    alt: "Positano rustic terrace overlooking the sea"
                }
            ]
        }
    ]
};

export const defaultUserSettings: UserSettings = {
    theme: "light",
    defaultBoardVisibility: "friends",
    emailNotifications: true
};

const PROFILE_STORAGE_KEY = "roamboard_mock_profile";
const SETTINGS_STORAGE_KEY = "roamboard_mock_settings";

// Cached baseline copy for resetting
const initialRowanProfile: UserProfile = JSON.parse(
    JSON.stringify(mockRowanProfile)
);

const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((listener) => listener());
}

export function subscribeMockStore(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

const store: {
    profile: UserProfile;
    settings: UserSettings;
} = {
    profile: { ...mockRowanProfile },
    settings: { ...defaultUserSettings }
};

if (typeof window !== "undefined") {
    try {
        const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (storedProfile) {
            store.profile = {
                ...store.profile,
                ...JSON.parse(storedProfile)
            };
            store.profile.tier = calculateTravelerTier(
                store.profile.mapStats
            ).name;
            Object.assign(mockRowanProfile, store.profile);
        }
        const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (storedSettings) {
            store.settings = {
                ...store.settings,
                ...JSON.parse(storedSettings)
            };
        }
    } catch {
        // Ignore parse errors in local storage
    }
}

export function getMockProfile(): UserProfile {
    return store.profile;
}

export function updateMockProfile(patch: Partial<UserProfile>): UserProfile {
    store.profile = {
        ...store.profile,
        ...patch,
        details: {
            ...store.profile.details,
            ...(patch.details ?? {})
        },
        stats: {
            ...store.profile.stats,
            ...(patch.stats ?? {})
        },
        mapStats: {
            ...store.profile.mapStats,
            ...(patch.mapStats ?? {})
        }
    };
    if (patch.location) {
        store.profile.details.location = patch.location;
    }

    // Traveler tier is automatically granted based on travel history
    store.profile.tier = calculateTravelerTier(
        store.profile.mapStats
    ).name;

    Object.assign(mockRowanProfile, store.profile);

    if (typeof window !== "undefined") {
        try {
            localStorage.setItem(
                PROFILE_STORAGE_KEY,
                JSON.stringify(store.profile)
            );
        } catch {
            // Ignore storage errors
        }
    }

    notify();
    return store.profile;
}

export function resetMockProfile(): UserProfile {
    store.profile = JSON.parse(JSON.stringify(initialRowanProfile));
    store.profile.tier = calculateTravelerTier(
        store.profile.mapStats
    ).name;
    Object.assign(mockRowanProfile, store.profile);
    if (typeof window !== "undefined") {
        try {
            localStorage.removeItem(PROFILE_STORAGE_KEY);
        } catch {
            // Ignore storage errors
        }
    }
    notify();
    return store.profile;
}

export function getMockSettings(): UserSettings {
    return store.settings;
}

export function updateMockSettings(patch: Partial<UserSettings>): UserSettings {
    store.settings = { ...store.settings, ...patch };

    if (typeof window !== "undefined") {
        try {
            localStorage.setItem(
                SETTINGS_STORAGE_KEY,
                JSON.stringify(store.settings)
            );
            if (patch.theme) {
                if (patch.theme === "dark") {
                    document.documentElement.classList.add("dark");
                } else {
                    document.documentElement.classList.remove("dark");
                }
            }
        } catch {
            // Ignore storage errors
        }
    }
    notify();
    return store.settings;
}

