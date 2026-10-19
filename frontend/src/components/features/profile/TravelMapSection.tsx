import type { ReactNode } from "react";
import type { ProfileStats } from "@/lib/profile";

type Props = {
    stats: Pick<
        ProfileStats,
        "countriesVisited" | "citiesExplored" | "continentsCovered" | "photosUploaded" | "activitiesDone"
    > | null;
    mapComponent: ReactNode;
    publicView?: boolean;
};

export default function TravelMapSection({ stats, mapComponent, publicView = false }: Props) {
    const counts = stats
        ? [
              [stats.countriesVisited, "countries visited"],
              [stats.citiesExplored, "cities explored"],
              [stats.continentsCovered, "continents covered"],
              [stats.photosUploaded.toLocaleString("en-US"), "photos uploaded"],
              [stats.activitiesDone.toLocaleString("en-US"), "activities done"]
          ]
        : [];

    return (
        <section aria-label="Travel map" className="border-line mt-12 border-t pt-8">
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
                <div className="lg:col-span-3">
                    <div>
                        <h3 className="font-display text-20 sm:text-22 text-foreground font-bold">
                            {publicView ? "travel map" : "my map"}
                        </h3>
                        <p className="text-12 text-muted-foreground mt-0.5 font-medium">
                            {publicView ? "places shared on visible boards" : "places on my published boards"}
                        </p>
                    </div>
                    <div className="mt-8 flex flex-col gap-6 lg:h-128 lg:justify-between">
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
                </div>
                <div className="relative min-w-0 lg:col-span-9">{mapComponent}</div>
            </div>
        </section>
    );
}
