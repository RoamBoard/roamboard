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
        if (countries >= tier.minCountries && cities >= tier.minCities && continents >= tier.minContinents) {
            return tier;
        }
    }

    return TRAVELER_TIERS[TRAVELER_TIERS.length - 1];
}

export function getTierGradientStyle(tier: string): string {
    const normalized = (tier || "").toUpperCase();
    if (normalized.includes("PLATINUM")) {
        return "from-stone-400 via-stone-100 to-slate-400 bg-gradient-to-r bg-clip-text text-transparent drop-shadow-[0_8px_20px_rgba(0,0,0,0.18)]";
    }
    if (normalized.includes("GOLD")) {
        return "from-amber-600 via-yellow-200 to-amber-500 bg-gradient-to-r bg-clip-text text-transparent drop-shadow-[0_8px_20px_rgba(180,83,9,0.25)]";
    }
    if (normalized.includes("SILVER")) {
        return "from-slate-500 via-stone-200 to-slate-300 bg-gradient-to-r bg-clip-text text-transparent drop-shadow-[0_8px_20px_rgba(0,0,0,0.15)]";
    }
    if (normalized.includes("BRONZE")) {
        return "from-amber-800 via-amber-300 to-stone-600 bg-gradient-to-r bg-clip-text text-transparent drop-shadow-[0_8px_20px_rgba(120,53,15,0.25)]";
    }
    return "from-foreground via-muted-foreground to-stone-400 bg-gradient-to-r bg-clip-text text-transparent drop-shadow-[0_6px_14px_rgba(0,0,0,0.15)]";
}
