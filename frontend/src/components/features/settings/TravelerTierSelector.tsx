import { TRAVELER_TIERS } from "@/utils/tier";
import type { UserProfile } from "@/types/social";

type Props = {
    selectedTier: string;
    onSelectTier: (tier: string) => void;
    mapStats: UserProfile["mapStats"];
};

export default function TravelerTierSelector({ selectedTier, onSelectTier, mapStats }: Props) {
    return (
        <div className="border-line bg-background rounded-[2px] border p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <span className="text-10 tracking-label text-muted-foreground block font-bold uppercase">
                        Traveler Tier
                    </span>
                    <div className="mt-1 flex items-center gap-3">
                        <span className="font-display text-24 sm:text-28 text-foreground font-bold uppercase">
                            {selectedTier}
                        </span>
                        <span className="border-line text-10 tracking-label text-foreground font-body bg-faint rounded-[2px] border px-2.5 py-1 font-bold uppercase">
                            Design &amp; Testing Mode
                        </span>
                    </div>
                </div>
            </div>

            <p className="text-12 text-muted-foreground mt-2 max-w-2xl leading-relaxed font-medium">
                Select any tier below to test and preview how each metallic grade renders across your profile and
                boards. Saving changes will persist this tier to mock data.
            </p>

            {/* Current Qualifying Stats */}
            <div className="border-line mt-5 grid grid-cols-2 gap-3 border-t pt-5 sm:grid-cols-4">
                <div className="bg-faint/40 border-line rounded-[2px] border p-3">
                    <span className="text-10 text-muted-foreground block font-medium">Countries Visited</span>
                    <span className="font-display text-18 text-foreground font-bold">{mapStats.countriesVisited}</span>
                </div>
                <div className="bg-faint/40 border-line rounded-[2px] border p-3">
                    <span className="text-10 text-muted-foreground block font-medium">Cities Explored</span>
                    <span className="font-display text-18 text-foreground font-bold">{mapStats.citiesExplored}</span>
                </div>
                <div className="bg-faint/40 border-line rounded-[2px] border p-3">
                    <span className="text-10 text-muted-foreground block font-medium">Continents Covered</span>
                    <span className="font-display text-18 text-foreground font-bold">{mapStats.continentsCovered}</span>
                </div>
                <div className="bg-faint/40 border-line rounded-[2px] border p-3">
                    <span className="text-10 text-muted-foreground block font-medium">Photos Taken</span>
                    <span className="font-display text-18 text-foreground font-bold">
                        {mapStats.photosTaken.toLocaleString("en-US")}
                    </span>
                </div>
            </div>

            {/* Tier Selection & Milestone List */}
            <div className="border-line mt-5 border-t pt-4">
                <span className="text-10 tracking-label text-muted-foreground mb-3 block font-bold uppercase">
                    Select Tier (Click to Preview &amp; Test)
                </span>
                <div className="space-y-2">
                    {TRAVELER_TIERS.map((t) => {
                        const isSelected = selectedTier === t.name;

                        return (
                            <button
                                key={t.name}
                                type="button"
                                onClick={() => onSelectTier(t.name)}
                                className={`border-line text-12 flex w-full cursor-pointer items-center justify-between rounded-[2px] border px-3.5 py-2.5 text-left transition-all ${
                                    isSelected
                                        ? "border-foreground bg-faint text-foreground ring-foreground/30 font-bold shadow-2xs ring-1"
                                        : "bg-background text-muted-foreground hover:text-foreground hover:bg-faint/30 font-medium"
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <span
                                        className={`flex size-3.5 shrink-0 items-center justify-center rounded-full border ${
                                            isSelected ? "border-foreground bg-foreground" : "border-line"
                                        }`}
                                        aria-hidden="true"
                                    >
                                        {isSelected && <span className="bg-background size-1.5 rounded-full" />}
                                    </span>
                                    <span className="font-display text-13 tracking-tight uppercase">{t.name}</span>
                                    {isSelected && (
                                        <span className="bg-foreground text-10 text-background rounded-[2px] px-1.5 py-0.5 font-bold uppercase">
                                            Active
                                        </span>
                                    )}
                                </div>

                                <span className="text-10 text-muted-foreground font-body">
                                    {t.minCountries > 0
                                        ? `${t.minCountries}+ countries · ${t.minCities}+ cities · ${t.minContinents}+ continents`
                                        : "Entry tier for all new travelers"}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
