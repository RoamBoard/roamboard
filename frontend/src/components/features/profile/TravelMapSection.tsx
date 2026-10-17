import type { ReactNode } from "react";
import type { ProfileStats } from "@/lib/profile";

type Props = {
    stats: Pick<ProfileStats, "countriesVisited" | "citiesExplored" | "continentsCovered" | "photosUploaded"> | null;
    mapComponent: ReactNode;
    publicView?: boolean;
};

export default function TravelMapSection({ stats, mapComponent, publicView = false }: Props) {
    const counts = stats
        ? [
              [stats.countriesVisited, "countries visited"],
              [stats.citiesExplored, "cities explored"],
              [stats.continentsCovered, "continents covered"],
              [stats.photosUploaded.toLocaleString("en-US"), "photos uploaded"]
          ]
        : [];

    return (
        <section aria-label="Travel map" className="border-line mt-12 border-t pt-8">
            <div>
                <h3 className="font-display text-20 sm:text-22 text-foreground font-bold">
                    {publicView ? "travel map" : "my map"}
                </h3>
                <p className="text-12 text-muted-foreground mt-0.5 font-medium">
                    {publicView ? "places visited on public boards" : "places I've been"}
                </p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
                <div className="flex flex-col justify-around gap-6 lg:col-span-3">
                    {stats ? (
                        counts.map(([value, label]) => (
                            <div key={label}>
                                <div className="font-display text-22 text-foreground flex items-center gap-1 font-bold">
                                    {value}
                                    <span className="text-12 text-muted-foreground font-normal" aria-hidden="true">
                                        →
                                    </span>
                                </div>
                                <div className="text-10 tracking-label text-muted-foreground mt-1 font-bold uppercase">
                                    {label}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted-foreground text-sm">Statistics could not be loaded.</p>
                    )}
                </div>
                <div className="relative flex items-center justify-center lg:col-span-9">{mapComponent}</div>
            </div>
        </section>
    );
}
