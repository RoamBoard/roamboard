import Image from "next/image";
import type { UserProfile } from "@/types/social";

type Props = {
    profile: UserProfile;
};

export default function TravelMapSection({ profile }: Props) {
    return (
        <section
            aria-label="Travel map"
            className="border-line mt-12 border-t pt-8"
        >
            {/* Header */}
            <div>
                <h3 className="font-display text-20 sm:text-22 text-obsidian font-bold">
                    my map
                </h3>
                <p className="text-12 text-graphite mt-0.5 font-medium">
                    places I&apos;ve been &amp; want to go
                </p>
            </div>

            {/* Map & Stats grid */}
            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
                {/* Left column: stats */}
                <div className="flex flex-col justify-around gap-6 lg:col-span-3">
                    <div>
                        <div className="font-display text-22 text-obsidian flex items-center gap-1 font-bold">
                            {profile.mapStats.countriesVisited}
                            <span
                                className="text-12 text-graphite font-normal"
                                aria-hidden="true"
                            >
                                →
                            </span>
                        </div>
                        <div className="text-10 tracking-label text-graphite mt-1 font-bold uppercase">
                            countries visited
                        </div>
                    </div>

                    <div>
                        <div className="font-display text-22 text-obsidian flex items-center gap-1 font-bold">
                            {profile.mapStats.citiesExplored}
                            <span
                                className="text-12 text-graphite font-normal"
                                aria-hidden="true"
                            >
                                →
                            </span>
                        </div>
                        <div className="text-10 tracking-label text-graphite mt-1 font-bold uppercase">
                            cities explored
                        </div>
                    </div>

                    <div>
                        <div className="font-display text-22 text-obsidian flex items-center gap-1 font-bold">
                            {profile.mapStats.continentsCovered}
                            <span
                                className="text-12 text-graphite font-normal"
                                aria-hidden="true"
                            >
                                →
                            </span>
                        </div>
                        <div className="text-10 tracking-label text-graphite mt-1 font-bold uppercase">
                            continents covered
                        </div>
                    </div>

                    <div>
                        <div className="font-display text-22 text-obsidian flex items-center gap-1 font-bold">
                            {profile.mapStats.photosTaken.toLocaleString(
                                "en-US"
                            )}
                            <span
                                className="text-12 text-graphite font-normal"
                                aria-hidden="true"
                            >
                                →
                            </span>
                        </div>
                        <div className="text-10 tracking-label text-graphite mt-1 font-bold uppercase">
                            photos taken
                        </div>
                    </div>
                </div>

                {/* Right column: World Map vector visualization */}
                <div className="relative flex items-center justify-center lg:col-span-9">
                    <div className="relative aspect-[2/1] min-h-[16rem] w-full">
                        <svg
                            viewBox="0 0 1000 500"
                            className="h-full w-full select-none"
                            aria-label="World map showing visited cities"
                        >
                            {/* Continents - simplified minimalist vector geometries */}
                            <g
                                fill="#e7e7e7"
                                stroke="#d2d2d2"
                                strokeWidth="0.75"
                            >
                                {/* North America */}
                                <path d="M 80,70 L 140,55 L 210,60 L 260,80 L 270,120 L 220,130 L 210,160 L 230,190 L 190,210 L 175,260 L 155,270 L 140,240 L 120,210 L 90,170 L 70,120 Z" />
                                {/* Greenland */}
                                <path d="M 290,45 L 340,35 L 370,60 L 330,85 L 295,75 Z" />
                                {/* South America */}
                                <path d="M 210,270 L 270,280 L 320,330 L 300,410 L 260,470 L 230,440 L 215,360 L 200,310 Z" />
                                {/* Europe */}
                                <path d="M 460,90 L 510,80 L 540,110 L 515,165 L 470,170 L 450,140 L 430,145 L 435,115 Z" />
                                {/* United Kingdom & Ireland */}
                                <path d="M 425,100 L 440,95 L 435,120 L 420,115 Z" />
                                <path d="M 410,105 L 420,105 L 415,120 L 405,115 Z" />
                                {/* Africa */}
                                <path d="M 460,180 L 540,185 L 590,240 L 585,310 L 540,390 L 490,395 L 450,290 L 435,240 L 445,195 Z" />
                                {/* Madagascar */}
                                <path d="M 605,335 L 620,330 L 610,380 L 595,370 Z" />
                                {/* Asia */}
                                <path d="M 540,80 L 640,65 L 750,70 L 850,95 L 890,150 L 830,180 L 780,240 L 710,250 L 670,220 L 610,210 L 550,170 Z" />
                                {/* Indian Subcontinent */}
                                <path d="M 640,210 L 690,220 L 675,290 L 640,280 Z" />
                                {/* Southeast Asia & Archipelago */}
                                <path d="M 720,245 L 760,250 L 780,290 L 740,310 L 715,280 Z" />
                                <path d="M 780,315 L 835,320 L 810,345 L 760,335 Z" />
                                {/* Japan */}
                                <path d="M 860,140 L 880,155 L 865,190 L 845,170 Z" />
                                {/* Australia */}
                                <path d="M 760,360 L 850,350 L 870,410 L 825,450 L 770,440 L 740,390 Z" />
                                {/* New Zealand */}
                                <path d="M 890,430 L 910,435 L 900,470 L 880,455 Z" />
                            </g>

                            {/* Continent text labels */}
                            <g
                                fill="#818181"
                                className="font-body text-[10px] font-bold tracking-widest uppercase select-none"
                            >
                                <text x="140" y="150">
                                    NORTH AMERICA
                                </text>
                                <text x="240" y="360">
                                    SOUTH AMERICA
                                </text>
                                <text x="475" y="125">
                                    EUROPE
                                </text>
                                <text x="495" y="275">
                                    AFRICA
                                </text>
                                <text x="715" y="145">
                                    ASIA
                                </text>
                                <text x="790" y="405">
                                    AUSTRALIA
                                </text>
                            </g>

                            {/* Destination marker pins */}
                            <g className="group cursor-pointer">
                                <circle
                                    cx="118"
                                    cy="168"
                                    r="7"
                                    fill="none"
                                    stroke="#161616"
                                    strokeWidth="1"
                                    opacity="0.25"
                                />
                                <circle
                                    cx="118"
                                    cy="168"
                                    r="3.5"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="215"
                                    cy="165"
                                    r="7"
                                    fill="none"
                                    stroke="#161616"
                                    strokeWidth="1"
                                    opacity="0.25"
                                />
                                <circle
                                    cx="215"
                                    cy="165"
                                    r="3.5"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="122"
                                    cy="140"
                                    r="3.5"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="270"
                                    cy="420"
                                    r="3.5"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="415"
                                    cy="80"
                                    r="3.5"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="455"
                                    cy="138"
                                    r="8"
                                    fill="none"
                                    stroke="#161616"
                                    strokeWidth="1"
                                    opacity="0.3"
                                />
                                <circle
                                    cx="455"
                                    cy="138"
                                    r="4"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="490"
                                    cy="132"
                                    r="3.5"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="488"
                                    cy="162"
                                    r="4"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="538"
                                    cy="195"
                                    r="4"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="518"
                                    cy="385"
                                    r="4"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="738"
                                    cy="245"
                                    r="8"
                                    fill="none"
                                    stroke="#161616"
                                    strokeWidth="1"
                                    opacity="0.3"
                                />
                                <circle
                                    cx="738"
                                    cy="245"
                                    r="4"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="752"
                                    cy="225"
                                    r="3.5"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="862"
                                    cy="168"
                                    r="10"
                                    fill="none"
                                    stroke="#161616"
                                    strokeWidth="1"
                                    opacity="0.3"
                                />
                                <circle
                                    cx="862"
                                    cy="168"
                                    r="5"
                                    fill="#161616"
                                />
                            </g>
                            <g className="group cursor-pointer">
                                <circle
                                    cx="855"
                                    cy="425"
                                    r="4"
                                    fill="#161616"
                                />
                            </g>
                        </svg>
                    </div>
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
                            <span className="text-11 text-graphite leading-tight font-normal">
                                {milestone.label}
                            </span>
                            <span className="font-display text-34 sm:text-40 text-obsidian my-1 leading-none font-bold tracking-tight whitespace-pre-line">
                                {milestone.value}
                            </span>
                            <span className="text-11 text-stone leading-tight font-normal">
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
                            <div className="bg-porcelain absolute top-2 left-0 h-20 w-13 overflow-hidden rounded-[1px] shadow-xs">
                                <Image
                                    src={milestone.images[0]?.url ?? ""}
                                    alt={milestone.images[0]?.alt ?? ""}
                                    fill
                                    sizes="60px"
                                    className="object-cover"
                                />
                            </div>

                            {/* Center photo (overlapping in front, taller, prominent) */}
                            <div className="bg-porcelain absolute top-0 left-6 z-10 h-26 w-15 overflow-hidden rounded-[1px] shadow-md">
                                <Image
                                    src={milestone.images[1]?.url ?? ""}
                                    alt={milestone.images[1]?.alt ?? ""}
                                    fill
                                    sizes="70px"
                                    className="object-cover"
                                />
                            </div>

                            {/* Right photo (behind center, to the right) */}
                            <div className="bg-porcelain absolute top-3 right-0 h-20 w-13 overflow-hidden rounded-[1px] shadow-xs">
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
