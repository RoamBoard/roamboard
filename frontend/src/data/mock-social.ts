import type { UserProfile, UserSettings } from "@/types/social";
import { calculateTravelerTier } from "@/utils/tier";
import { getBoardTag, boardTags, type BoardTagId } from "@/data/board-tags";

export const mockRowanProfile: UserProfile = {
    id: "user-rowan-mercer",
    name: "ROWAN",
    handle: "@rowan.mercer",
    avatarUrl: "library:frontend.unsplash.41db7fb4311d2054",
    location: "San Fransisco, USA",
    headline: "Chasing places, collecting stories.",
    bio: 'Usually somewhere between "I made an itinerary" and "we\'ll figure it out when we get there." I travel for the food, the views, the people, and the completely unnecessary side quests that somehow become the best part of the trip.',
    occupation: "Travel Writer & Photographer",
    tier: "PLATINUM TRAVELER",
    stats: {
        countriesVisited: 32,
        boardsCreated: 12,
        friendsMade: 48,
        placesSaved: 127,
        boardsSaved: 68
    },
    details: {
        location: "San Francisco, USA",
        languages: ["English", "Italian", "German"],
        occupation: "Travel Writer & Photographer",
        tags: ["photography", "foodie", "hiking"],
        interests: ["photography", "foodie", "hiking"]
    },
    inspiredBoards: [
        {
            id: "board-tokyo",
            titleLines: ["Lost in", "Tokyo"],
            author: "by Noah Fischer",
            duration: "4 days",
            countryCode: "JPN",
            quote: "Neon streets, tiny bars, late-night ramen and absolutely no idea which train exit to take.",
            tags: ["city-life", "hidden-gems", "foodie"],
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
                    url: "library:frontend.unsplash.39ce2a6bfb993c6c",
                    alt: "Tokyo red tower"
                },
                {
                    url: "library:frontend.unsplash.1c753fdb75bc8a55",
                    alt: "Tokyo neon alley"
                },
                {
                    url: "library:frontend.unsplash.8af634962a6d50bc",
                    alt: "Tokyo lantern street"
                },
                {
                    url: "library:frontend.unsplash.5e72887d0d3f7f08",
                    alt: "Tokyo alley bars"
                },
                {
                    url: "library:frontend.unsplash.4c9518b691c46948",
                    alt: "Shinjuku night skyline"
                },
                {
                    url: "library:frontend.unsplash.1682d9969d7ef24c",
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
            tags: ["cafe-hopping", "romantic", "city-life"],
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
                    url: "library:frontend.unsplash.f058865b59d2e7e3",
                    alt: "Eiffel tower and classic Parisian avenue"
                },
                {
                    url: "library:frontend.unsplash.6231787db47b8bbd",
                    alt: "Pont Alexandre III at sunset"
                },
                {
                    url: "library:frontend.unsplash.26e5387122aacb78",
                    alt: "Parisian sidewalk café"
                },
                {
                    url: "library:frontend.unsplash.843eb666abba6b2e",
                    alt: "Eiffel Tower viewed from Seine"
                },
                {
                    url: "library:frontend.unsplash.f9f6f9e599ddd3e2",
                    alt: "Louvre glass pyramid at twilight"
                },
                {
                    url: "library:frontend.unsplash.a1630a73793b3a28",
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
            tags: ["street-food", "markets", "culture"],
            highlights: ["Wat Arun", "Chinatown", "Chatuchak Market", "Talat Noi", "Wat Pho", "Yaowarat Road"],
            savedCount: "Saved by 1,932 travelers",
            images: [
                {
                    url: "library:frontend.unsplash.dd2b1465d6d1ab51",
                    alt: "Wat Arun temple at dawn"
                },
                {
                    url: "library:frontend.unsplash.4b9afeaddd6f486a",
                    alt: "Bangkok tuk-tuk in Chinatown"
                },
                {
                    url: "library:frontend.unsplash.e2a41519d15792c9",
                    alt: "Longtail wooden boat on river"
                },
                {
                    url: "library:frontend.unsplash.65e3de1264b6fa5b",
                    alt: "Chao Phraya sunset over temples"
                },
                {
                    url: "library:frontend.unsplash.87702fad7958d19c",
                    alt: "Bangkok street night market"
                },
                {
                    url: "library:frontend.unsplash.6ee43a65bb6b0e07",
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
            tags: ["city-life", "hidden-gems", "foodie"],
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
                    url: "library:frontend.unsplash.39ce2a6bfb993c6c",
                    alt: "Tokyo red tower"
                },
                {
                    url: "library:frontend.unsplash.1c753fdb75bc8a55",
                    alt: "Tokyo neon alley"
                },
                {
                    url: "library:frontend.unsplash.8af634962a6d50bc",
                    alt: "Tokyo lantern street"
                },
                {
                    url: "library:frontend.unsplash.5e72887d0d3f7f08",
                    alt: "Tokyo alley bars"
                },
                {
                    url: "library:frontend.unsplash.4c9518b691c46948",
                    alt: "Shinjuku night skyline"
                },
                {
                    url: "library:frontend.unsplash.1682d9969d7ef24c",
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
            tags: ["cafe-hopping", "romantic", "city-life"],
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
                    url: "library:frontend.unsplash.f058865b59d2e7e3",
                    alt: "Eiffel tower and classic Parisian avenue"
                },
                {
                    url: "library:frontend.unsplash.6231787db47b8bbd",
                    alt: "Pont Alexandre III at sunset"
                },
                {
                    url: "library:frontend.unsplash.26e5387122aacb78",
                    alt: "Parisian sidewalk café"
                },
                {
                    url: "library:frontend.unsplash.843eb666abba6b2e",
                    alt: "Eiffel Tower viewed from Seine"
                },
                {
                    url: "library:frontend.unsplash.f9f6f9e599ddd3e2",
                    alt: "Louvre glass pyramid at twilight"
                },
                {
                    url: "library:frontend.unsplash.a1630a73793b3a28",
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
            tags: ["street-food", "markets", "culture"],
            highlights: ["Wat Arun", "Chinatown", "Chatuchak Market", "Talat Noi", "Wat Pho", "Yaowarat Road"],
            savedCount: "Saved by 1,932 travelers",
            images: [
                {
                    url: "library:frontend.unsplash.dd2b1465d6d1ab51",
                    alt: "Wat Arun temple at dawn"
                },
                {
                    url: "library:frontend.unsplash.4b9afeaddd6f486a",
                    alt: "Bangkok tuk-tuk in Chinatown"
                },
                {
                    url: "library:frontend.unsplash.e2a41519d15792c9",
                    alt: "Longtail wooden boat on river"
                },
                {
                    url: "library:frontend.unsplash.65e3de1264b6fa5b",
                    alt: "Chao Phraya sunset over temples"
                },
                {
                    url: "library:frontend.unsplash.87702fad7958d19c",
                    alt: "Bangkok street night market"
                },
                {
                    url: "library:frontend.unsplash.6ee43a65bb6b0e07",
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
                    url: "library:frontend.unsplash.1682d9969d7ef24c",
                    alt: "Senso-ji pagoda close-up"
                },
                {
                    url: "library:frontend.unsplash.1c753fdb75bc8a55",
                    alt: "Tokyo vibrant neon alley"
                },
                {
                    url: "library:frontend.unsplash.39ce2a6bfb993c6c",
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
                    url: "library:frontend.unsplash.6f388dc88faf20d8",
                    alt: "Santorini cliffside white village"
                },
                {
                    url: "library:frontend.unsplash.b00a5a12b1e0519d",
                    alt: "Greek seaside dining with white chairs"
                },
                {
                    url: "library:frontend.unsplash.c295709664de669f",
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
                    url: "library:frontend.unsplash.183ce167c753aa6b",
                    alt: "Desert canyon rock formations"
                },
                {
                    url: "library:frontend.unsplash.d492b9ab9906412d",
                    alt: "Manhattan avenue canyon perspective"
                },
                {
                    url: "library:frontend.unsplash.5ab37360c57936bb",
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
                    url: "library:frontend.unsplash.9a2e4c3d730c1c81",
                    alt: "Cinque Terre colorful coastal village"
                },
                {
                    url: "library:frontend.unsplash.b00a5a12b1e0519d",
                    alt: "Amalfi beach umbrellas in turquoise water"
                },
                {
                    url: "library:frontend.unsplash.bb3f01d3bdc6eb40",
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
const initialRowanProfile: UserProfile = JSON.parse(JSON.stringify(mockRowanProfile));

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

const AUTH_STORAGE_KEY = "roamboard_mock_auth";

const store: {
    profile: UserProfile;
    settings: UserSettings;
    isLoggedIn: boolean;
} = {
    profile: { ...mockRowanProfile },
    settings: { ...defaultUserSettings },
    isLoggedIn: false
};

const storeMeta = {
    isRestored: false
};

export function restoreMockStore(): void {
    if (storeMeta.isRestored) return;
    if (typeof window === "undefined") return;
    storeMeta.isRestored = true;

    try {
        const rawStoredProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (rawStoredProfile) {
            const cleanedProfileStr = rawStoredProfile.replace(
                /photo-1520939817895-060bdef4dc1b/g,
                "photo-1550340499-a6c60fc8287c"
            );
            const parsed = JSON.parse(cleanedProfileStr);
            const rawTags = parsed.details?.tags ?? parsed.details?.interests;
            const migratedTags: BoardTagId[] = Array.isArray(rawTags)
                ? (rawTags as unknown[])
                      .map((val): BoardTagId | undefined => {
                          const str = String(val ?? "");
                          const direct = getBoardTag(str);
                          if (direct) return direct.id;
                          const found = boardTags.find(
                              (t) =>
                                  t.id.toLowerCase() === str.toLowerCase() || t.name.toLowerCase() === str.toLowerCase()
                          );
                          return found?.id;
                      })
                      .filter((id): id is BoardTagId => Boolean(id))
                      .slice(0, 10)
                : mockRowanProfile.details.tags;

            const hasStoredTags = Array.isArray(rawTags);
            const resolvedTags: BoardTagId[] = hasStoredTags ? migratedTags : mockRowanProfile.details.tags;

            store.profile = {
                ...store.profile,
                ...parsed,
                details: {
                    ...store.profile.details,
                    ...(parsed.details ?? {}),
                    tags: resolvedTags,
                    interests: resolvedTags
                },
                // Curated boards always use the source mock definitions so image fixes take effect
                inspiredBoards: mockRowanProfile.inspiredBoards,
                myBoards: mockRowanProfile.myBoards
            };
            store.profile.tier = parsed.tier ?? calculateTravelerTier(store.profile.mapStats).name;
            Object.assign(mockRowanProfile, store.profile);

            // Persist the migrated profile immediately so localStorage is permanently fixed
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(store.profile));
        }
        const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (storedSettings) {
            store.settings = {
                ...store.settings,
                ...JSON.parse(storedSettings)
            };
        }
        const storedRoamTheme = localStorage.getItem("roamboard-theme");
        if (storedRoamTheme === "dark" || storedRoamTheme === "light") {
            store.settings.theme = storedRoamTheme;
        }
        const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
        if (storedAuth !== null) {
            store.isLoggedIn = storedAuth === "true";
        }
        notify();
    } catch {
        // Ignore parse errors in local storage
    }
}

export function getMockProfileServerSnapshot(): UserProfile {
    return initialRowanProfile;
}

export function getMockSettingsServerSnapshot(): UserSettings {
    return defaultUserSettings;
}

export function getMockAuthState(): boolean {
    return store.isLoggedIn;
}

export function getMockAuthStateServerSnapshot(): boolean {
    return false;
}

export function setMockAuthState(isLoggedIn: boolean): void {
    store.isLoggedIn = isLoggedIn;
    if (typeof window !== "undefined") {
        try {
            localStorage.setItem(AUTH_STORAGE_KEY, String(isLoggedIn));
        } catch {
            // Ignore storage errors
        }
    }
    notify();
}

export function getMockProfile(): UserProfile {
    return store.profile;
}

export function updateMockProfile(patch: Partial<UserProfile>): UserProfile {
    storeMeta.isRestored = true;
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
    if (patch.occupation) {
        store.profile.details.occupation = patch.occupation;
    }
    if (patch.details?.tags) {
        store.profile.details.tags = patch.details.tags;
        store.profile.details.interests = patch.details.tags;
    } else if (patch.details?.interests) {
        store.profile.details.tags = patch.details.interests;
        store.profile.details.interests = patch.details.interests;
    }

    if (patch.tier) {
        store.profile.tier = patch.tier;
    } else if (!store.profile.tier) {
        store.profile.tier = calculateTravelerTier(store.profile.mapStats).name;
    }

    Object.assign(mockRowanProfile, store.profile);

    if (typeof window !== "undefined") {
        try {
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(store.profile));
        } catch {
            // Ignore storage errors
        }
    }

    notify();
    return store.profile;
}

export function resetMockProfile(): UserProfile {
    storeMeta.isRestored = true;
    store.profile = JSON.parse(JSON.stringify(initialRowanProfile));
    store.profile.tier = calculateTravelerTier(store.profile.mapStats).name;
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
    storeMeta.isRestored = true;
    store.settings = { ...store.settings, ...patch };

    if (typeof window !== "undefined") {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(store.settings));
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
