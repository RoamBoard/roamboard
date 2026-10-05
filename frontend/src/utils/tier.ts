export type TravelerTierInfo = {
    name: string;
    shortName: string;
    minCountries: number;
    minCities: number;
    minContinents: number;
    description: string;
};

export const TRAVELER_TIERS: readonly TravelerTierInfo[] = [
    {
        name: "PLATINUM TRAVELER",
        shortName: "Platinum",
        minCountries: 30,
        minCities: 50,
        minContinents: 4,
        description: "World-class voyager with journeys spanning the globe."
    },
    {
        name: "GOLD TRAVELER",
        shortName: "Gold",
        minCountries: 20,
        minCities: 35,
        minContinents: 3,
        description: "Elite explorer with extensive cross-continental adventures."
    },
    {
        name: "SILVER TRAVELER",
        shortName: "Silver",
        minCountries: 10,
        minCities: 20,
        minContinents: 2,
        description: "Accomplished traveler discovering diverse cultures."
    },
    {
        name: "BRONZE TRAVELER",
        shortName: "Bronze",
        minCountries: 5,
        minCities: 8,
        minContinents: 1,
        description: "Active traveler building memorable journeys."
    },
    {
        name: "EXPLORER",
        shortName: "Explorer",
        minCountries: 0,
        minCities: 0,
        minContinents: 1,
        description: "Curious wanderer beginning their travel story."
    }
] as const;

export function calculateTravelerTier(stats?: {
    countriesVisited?: number;
    citiesExplored?: number;
    continentsCovered?: number;
}): TravelerTierInfo {
    const countries = stats?.countriesVisited ?? 0;
    const cities = stats?.citiesExplored ?? 0;
    const continents = stats?.continentsCovered ?? 1;

    for (const tier of TRAVELER_TIERS) {
        if (
            countries >= tier.minCountries &&
            cities >= tier.minCities &&
            continents >= tier.minContinents
        ) {
            return tier;
        }
    }

    return TRAVELER_TIERS[TRAVELER_TIERS.length - 1];
}
