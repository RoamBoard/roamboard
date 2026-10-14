import type { ReactNode } from "react";
import Image from "next/image";
import type { UserProfile } from "@/types/social";

type Props = {
    profile: UserProfile;
    mapComponent?: ReactNode;
};

export default function TravelMapSection({ profile, mapComponent }: Props) {
    return (
        <section
            aria-label="Travel map"
            className="border-line mt-12 border-t pt-8"
        >
            {/* Header */}
            <div>
                <h3 className="font-display text-20 sm:text-22 text-foreground font-bold">
                    my map
                </h3>
                <p className="text-12 text-muted-foreground mt-0.5 font-medium">
                    places I&apos;ve been &amp; want to go
                </p>
            </div>

            {/* Map & Stats grid */}
            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
                {/* Left column: stats */}
                <div className="flex flex-col justify-around gap-6 lg:col-span-3">
                    <div>
                        <div className="font-display text-22 text-foreground flex items-center gap-1 font-bold">
                            {profile.mapStats.countriesVisited}
                            <span
                                className="text-12 text-muted-foreground font-normal"
                                aria-hidden="true"
                            >
                                →
                            </span>
                        </div>
                        <div className="text-10 tracking-label text-muted-foreground mt-1 font-bold uppercase">
                            countries visited
                        </div>
                    </div>

                    <div>
                        <div className="font-display text-22 text-foreground flex items-center gap-1 font-bold">
                            {profile.mapStats.citiesExplored}
                            <span
                                className="text-12 text-muted-foreground font-normal"
                                aria-hidden="true"
                            >
                                →
                            </span>
                        </div>
                        <div className="text-10 tracking-label text-muted-foreground mt-1 font-bold uppercase">
                            cities explored
                        </div>
                    </div>

                    <div>
                        <div className="font-display text-22 text-foreground flex items-center gap-1 font-bold">
                            {profile.mapStats.continentsCovered}
                            <span
                                className="text-12 text-muted-foreground font-normal"
                                aria-hidden="true"
                            >
                                →
                            </span>
                        </div>
                        <div className="text-10 tracking-label text-muted-foreground mt-1 font-bold uppercase">
                            continents covered
                        </div>
                    </div>

                    <div>
                        <div className="font-display text-22 text-foreground flex items-center gap-1 font-bold">
                            {profile.mapStats.photosTaken.toLocaleString(
                                "en-US"
                            )}
                            <span
                                className="text-12 text-muted-foreground font-normal"
                                aria-hidden="true"
                            >
                                →
                            </span>
                        </div>
                        <div className="text-10 tracking-label text-muted-foreground mt-1 font-bold uppercase">
                            photos taken
                        </div>
                    </div>
                </div>

                {/* Right column: Collaborator Map Component Slot / Placeholder */}
                <div className="relative flex items-center justify-center lg:col-span-9">
                    {mapComponent ?? (
                        <div
                            data-testid="travel-map-placeholder"
                            className="border-line bg-faint/30 relative flex aspect-[2/1] min-h-[18rem] w-full flex-col items-center justify-center rounded-[2px] border border-dashed p-8 text-center transition-colors"
                        >
                            {/* Drafting corner crosshairs */}
                            <span
                                aria-hidden="true"
                                className="text-muted-foreground/40 text-10 absolute top-2.5 left-2.5 font-mono select-none"
                            >
                                +
                            </span>
                            <span
                                aria-hidden="true"
                                className="text-muted-foreground/40 text-10 absolute top-2.5 right-2.5 font-mono select-none"
                            >
                                +
                            </span>
                            <span
                                aria-hidden="true"
                                className="text-muted-foreground/40 text-10 absolute bottom-2.5 left-2.5 font-mono select-none"
                            >
                                +
                            </span>
                            <span
                                aria-hidden="true"
                                className="text-muted-foreground/40 text-10 absolute right-2.5 bottom-2.5 font-mono select-none"
                            >
                                +
                            </span>

                            {/* Center icon & message */}
                            <div className="border-line/70 bg-background/80 flex size-11 items-center justify-center rounded-[2px] border shadow-xs">
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.75"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-muted-foreground"
                                    aria-hidden="true"
                                >
                                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                                    <line x1="9" x2="9" y1="3" y2="18" />
                                    <line x1="15" x2="15" y1="6" y2="21" />
                                </svg>
                            </div>

                            <span className="font-display text-14 text-foreground mt-3 font-bold tracking-tight uppercase">
                                Map Component Placeholder
                            </span>
                            <p className="text-11 text-muted-foreground mt-1 max-w-xs leading-relaxed font-medium">
                                Reserved for collaborator travel map
                                integration.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom travel milestones row with tightly grouped units */}
            <div className="border-line mt-12 grid grid-cols-1 gap-10 border-t pt-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8 xl:gap-12">
                {profile.milestones.map((milestone) => (
                    <div
                        key={milestone.id}
                        className="flex items-center justify-start gap-3.5"
                    >
                        {/* Text block: right-aligned directly against the divider */}
                        <div className="flex flex-col items-end text-right">
                            <span className="text-11 text-muted-foreground leading-tight font-normal">
                                {milestone.label}
                            </span>
                            <span className="font-display text-34 sm:text-40 text-foreground my-1 leading-none font-bold tracking-tight whitespace-pre-line">
                                {milestone.value}
                            </span>
                            <span className="text-11 text-muted-foreground leading-tight font-normal">
                                {milestone.subLabel}
                            </span>
                        </div>

                        {/* Thin vertical separator line */}
                        <div
                            className="bg-line h-22 w-px shrink-0 self-center"
                            aria-hidden="true"
                        />

                        {/* Tightly adjacent overlapping 3-photo cluster */}
                        <div className="relative h-26 w-28 shrink-0">
                            {/* Left photo (back, slightly left) */}
                            <div className="bg-faint absolute top-2 left-0 h-20 w-13 overflow-hidden rounded-[1px] shadow-xs">
                                <Image
                                    src={milestone.images[0]?.url ?? ""}
                                    alt={milestone.images[0]?.alt ?? ""}
                                    fill
                                    sizes="60px"
                                    className="object-cover"
                                />
                            </div>

                            {/* Center photo (overlapping in front, taller, prominent) */}
                            <div className="bg-faint absolute top-0 left-6 z-10 h-26 w-15 overflow-hidden rounded-[1px] shadow-md">
                                <Image
                                    src={milestone.images[1]?.url ?? ""}
                                    alt={milestone.images[1]?.alt ?? ""}
                                    fill
                                    sizes="70px"
                                    className="object-cover"
                                />
                            </div>

                            {/* Right photo (behind center, to the right) */}
                            <div className="bg-faint absolute top-3 right-0 h-20 w-13 overflow-hidden rounded-[1px] shadow-xs">
                                <Image
                                    src={milestone.images[2]?.url ?? ""}
                                    alt={milestone.images[2]?.alt ?? ""}
                                    fill
                                    sizes="60px"
                                    className="object-cover"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
